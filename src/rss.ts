/**
 * RSS 收集器 - 抓取多源RSS，交叉验证去重
 */


import { loadConfig, loadSources } from "./utils/util_config.ts";
import { saveJson } from "./utils/util_file.ts";
import { getBeijingDate, toBeijingTime } from "./utils/util_timezone.ts";
import { parallelWithRetry, parallel } from "./utils/util_concurrency.ts";
import type { NewsItem, RawData, Source, AppConfig } from "./type/types.ts";
import { Parser } from "htmlparser2";
import { titleSimilarity } from "./utils/util_similarity.ts";

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

/**
 * 使用 htmlparser2 修复版：
 * 1. 流式处理：边下载边解析，内存极其稳定。
 * 2. 结构化过滤：精准跳过 script, style, nav 等标签。
 * 3. 严格长度控制：一旦达到 maxLength 立即停止解析，节省性能。
 */
async function fetchContent(url: string, maxLength: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let resultText = "";


  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SeeSomething/2.0)" },
      signal: controller.signal,
    });

    if (!res.ok || !res.body) return "";

    let isSkipping = 0; // 记录嵌套层级，用于跳过不需要的标签块
    const skipTags = new Set(["script", "style", "nav", "header", "footer"]);

    // 初始化解码器，用于将 Uint8Array 转换为 string
    const decoder = new TextDecoder();

    const parser = new Parser({
      onopentag(name) {
        if (skipTags.has(name.toLowerCase())) {
          isSkipping++;
        }
      },
      ontext(data) {
        // 只有不在跳过标签内，且未超过长度限制时才累加
        if (isSkipping === 0 && resultText.length < maxLength) {
          const cleaned = data.replace(/\s+/g, " ");
          resultText += cleaned;
          
          // 如果长度已够，直接关闭解析器并中止请求
          // if (resultText.length >= maxLength) {
          //   parser.end();
          //   controller.abort(); 
          // }
        }
      },
      onclosetag(name) {
        if (skipTags.has(name.toLowerCase())) {
          isSkipping = Math.max(0, isSkipping - 1);
        }
      }
    }, { decodeEntities: true });

    // 将 Fetch 的 Web Stream 转换为 Node 可用的处理方式
    // @ts-ignore (Node 的 fetch body 是 ReadableStream)
    for await (const chunk of res.body) {
      // 将 Uint8Array 转换为字符串，stream: true 表示后续还有数据，处理截断字符
      const textChunk = decoder.decode(chunk as Uint8Array, { stream: true });
      parser.write(textChunk);
      if (resultText.length >= maxLength) break;
    }
    parser.end();

    return resultText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);

  } catch (err: any) {
    // 忽略主动中止请求产生的错误
    if (err.name === 'AbortError') {
      // 如果是因为长度足够而中止，此时 resultText 已有内容
      // 如果是因为超时中止，resultText 可能是部分内容
    }
    // 即使出错，只要 resultText 有内容也返回，否则返回空
    return (resultText || "").slice(0, maxLength);
  } finally {
    clearTimeout(timeout);
  }
}

/** 交叉验证去重：先按ID（link）去重，再按标题相似度合并 */
function crossValidate(items: NewsItem[], threshold: number): NewsItem[] {
  const result: NewsItem[] = [];

  for (const item of items) {
    let merged = false;
    for (const existing of result) {
      // 先检查ID是否相同（同一link）
      if (item.id === existing.id) {
        existing.sourceCount++;
        existing.allSources = [...new Set(existing.allSources.concat(item.source))];
        merged = true;
        break;
      }
      // 再检查标题相似度
      if (titleSimilarity(item.title, existing.title) >= threshold) {
        existing.sourceCount++;
        existing.allSources = [...new Set(existing.allSources.concat(item.source))];
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

/** 单个RSS源的收集结果 */
interface SourceResult {
  source: Source;
  items: NewsItem[];
  error?: string;
}

/** 收集单个RSS源 */
async function collectSource(source: Source, cfg: AppConfig): Promise<SourceResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(source.url, {
      headers: { "User-Agent": "SeeSomething/2.0 (Gaming News Aggregator)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`  ❌ [${source.id}] HTTP ${res.status}`);
      return { source, items: [], error: `HTTP ${res.status}` };
    }

    const xml = await res.text();
    const rawItems = parseRss(xml).slice(0, cfg.collection.max_per_source);

    // 并行获取文章内容
    const contents = cfg.collection.fetch_content
      ? await parallel(
          rawItems,
          cfg.collection.content_concurrency,
          (raw) => fetchContent(raw.link, cfg.collection.content_max_length)
        )
      : rawItems.map(() => "");

    const items: NewsItem[] = rawItems.map((raw, i) => ({
      id: Buffer.from(raw.link).toString("base64url"),
      title: raw.title,
      link: raw.link,
      source: source.id,
      sourceName: source.name,
      tier: source.tier,
      category: source.category,
      description: raw.description,
      content: contents[i],
      sourceCount: 0,
      allSources: [],
      timestamp: toBeijingTime(raw.pubDate),
      pubDate: raw.pubDate,
    }));

    console.log(`  ✅ [${source.id}] ${items.length} 条`);
    return { source, items };
  } catch (err) {
    console.error(`  ❌ [${source.id}] 错误: ${err}`);
    return { source, items: [], error: String(err) };
  }
}

/** 收集所有 RSS 源 */
export async function collect(): Promise<RawData> {
  const cfg = loadConfig();
  const sources = loadSources();
  const date = getBeijingDate();
  const fetchedAt = toBeijingTime(new Date());

  console.log(`📡 [rss] 开始收集 ${sources.length} 个源（并行 ${cfg.collection.rss_concurrency}）...`);

  // 并行获取所有RSS源
  const results = await parallelWithRetry(
    sources,
    cfg.collection.rss_concurrency,
    (source) => collectSource(source, cfg)
  );

  // 合并所有条目
  const rawItems: NewsItem[] = [];
  const sourceStats: Record<string, number> = {};

  for (const result of results) {
    rawItems.push(...result.items);
    sourceStats[result.source.id] = result.items.length;
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