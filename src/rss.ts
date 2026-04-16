/**
 * RSS 收集器 - 抓取多源RSS，交叉验证去重
 */

import fs from "node:fs";
import { loadConfig, loadSources, saveJson } from "./llm.ts";
import { getBeijingDate, toBeijingTime } from "./timezone.ts";
import type { NewsItem, RawData, Source } from "./types.ts";

// ============ RSS 解析 ============

/** 解析 RSS/Atom XML */
function parseRss(xml: string): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];

  // 尝试 RSS <item> 格式
  const itemRegex = /<item>(.*?)<\/item>/gis;
  for (const match of xml.matchAll(itemRegex)) {
    const content = match[1];
    const item = extractFields(content);
    if (item) items.push(item);
  }

  // 如果没有 RSS items，尝试 Atom <entry> 格式
  if (items.length === 0) {
    const entryRegex = /<entry>(.*?)<\/entry>/gis;
    for (const match of xml.matchAll(entryRegex)) {
      const content = match[1];
      const item = extractAtomFields(content);
      if (item) items.push(item);
    }
  }

  return items;
}

function extractFields(content: string) {
  const titleMatch = content.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
  const linkMatch = content.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
  const dateMatch = content.match(/<pubDate>(.*?)<\/pubDate>/i);
  const descMatch = content.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is);

  if (!titleMatch || !linkMatch) return null;
  return {
    title: titleMatch[1].trim(),
    link: linkMatch[1].trim(),
    pubDate: dateMatch ? dateMatch[1].trim() : new Date().toISOString(),
    description: descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 500) : "",
  };
}

function extractAtomFields(content: string) {
  const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
  const linkMatch = content.match(/<link[^>]*href="([^"]*)"[^>]*\/>/i)
    || content.match(/<link[^>]*>(.*?)<\/link>/i);
  const dateMatch = content.match(/<(?:published|updated)>(.*?)<\/(?:published|updated)>/i);
  const descMatch = content.match(/<(?:summary|content)[^>]*>(.*?)<\/(?:summary|content)>/is);

  if (!titleMatch || !linkMatch) return null;
  return {
    title: titleMatch[1].trim(),
    link: linkMatch[1].trim(),
    pubDate: dateMatch ? dateMatch[1].trim() : new Date().toISOString(),
    description: descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 500) : "",
  };
}

// ============ 文章内容抓取 ============

async function fetchContent(url: string, maxLength: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SeeSomething/2.0)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return "";
    const html = await res.text();

    // 提取正文
    const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
    if (!bodyMatch) return "";

    const text = bodyMatch[1]
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<nav[^>]*>.*?<\/nav>/gis, "")
      .replace(/<header[^>]*>.*?<\/header>/gis, "")
      .replace(/<footer[^>]*>.*?<\/footer>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text.slice(0, maxLength);
  } catch {
    return "";
  }
}

// ============ 标题相似度 ============

/** Jaccard 相似系数（基于关键词） */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = wordsA.size + wordsB.size - intersection;

  return union > 0 ? intersection / union : 0;
}

/** 交叉验证去重：相似标题合并，记录多源 */
function crossValidate(items: NewsItem[], threshold: number): NewsItem[] {
  const result: NewsItem[] = [];

  for (const item of items) {
    let merged = false;
    for (const existing of result) {
      if (titleSimilarity(item.title, existing.title) >= threshold) {
        existing.sourceCount++;
        existing.allSources.push(item.source);
        // 保留更高 tier 的信息
        if (item.tier < existing.tier) {
          existing.source = item.source;
          existing.sourceName = item.sourceName;
          existing.tier = item.tier;
        }
        // 保留更长的内容
        if (item.content.length > existing.content.length) {
          existing.content = item.content;
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      result.push({ ...item, sourceCount: 1, allSources: [item.source] });
    }
  }

  return result.sort((a, b) => b.sourceCount - a.sourceCount);
}

// ============ 主收集函数 ============

/** 收集所有 RSS 源 */
export async function collect(): Promise<RawData> {
  const cfg = loadConfig();
  const sources = loadSources();
  const date = getBeijingDate();
  const fetchedAt = toBeijingTime(new Date());

  console.log(`📡 [rss] 开始收集 ${sources.length} 个源...`);

  const rawItems: NewsItem[] = [];
  const sourceStats: Record<string, number> = {};

  for (const source of sources) {
    try {
      await new Promise(r => setTimeout(r, cfg.collection.rate_limit_ms));

      const res = await fetch(source.url, {
        headers: { "User-Agent": "SeeSomething/2.0 (Gaming News Aggregator)" },
      });

      if (!res.ok) {
        console.log(`  ❌ [${source.id}] HTTP ${res.status}`);
        sourceStats[source.id] = 0;
        continue;
      }

      const xml = await res.text();
      const items = parseRss(xml).slice(0, cfg.collection.max_per_source);

      let count = 0;
      for (const raw of items) {
        const id = Buffer.from(raw.link).toString("base64url").slice(0, 12);

        let content = raw.description;
        if (cfg.collection.fetch_content && !content) {
          content = await fetchContent(raw.link, cfg.collection.content_max_length);
        }

        rawItems.push({
          id,
          title: raw.title,
          link: raw.link,
          source: source.id,
          sourceName: source.name,
          tier: source.tier,
          category: source.category,
          content,
          sourceCount: 0,
          allSources: [],
          timestamp: toBeijingTime(raw.pubDate),
          pubDate: raw.pubDate,
        });
        count++;
      }

      sourceStats[source.id] = count;
      console.log(`  ✅ [${source.id}] ${count} 条`);
    } catch (err) {
      console.error(`  ❌ [${source.id}] 错误: ${err}`);
      sourceStats[source.id] = 0;
    }
  }

  // 交叉验证去重
  const items = crossValidate(rawItems, cfg.deduplication.similarity_threshold);
  console.log(`📊 [rss] 去重后 ${items.length} 条 (原始 ${rawItems.length} 条)`);

  // 输出多源报道
  const multiSource = items.filter(i => i.sourceCount >= 2);
  if (multiSource.length > 0) {
    console.log(`🔗 [rss] ${multiSource.length} 条被多源报道:`);
    for (const i of multiSource) {
      console.log(`   "${i.title.slice(0, 50)}..." → ${i.allSources.join(", ")}`);
    }
  }

  return { date, fetchedAt, items, sourceStats };
}

/** 保存原始数据 */
export function saveRawData(data: RawData): void {
  saveJson(`data/${data.date}/raw.json`, data);
  console.log(`💾 [save] data/${data.date}/raw.json`);
}

/** 导出相似度函数供其他模块使用 */
export { titleSimilarity };
