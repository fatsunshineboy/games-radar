/**
 * Markdown 解析器 - 从 digests/*.md 提取摘要和元数据
 */

import fs from "node:fs";
import path from "node:path";

/** 分类 emoji 映射 */
const CATEGORY_EMOJI: Record<string, string> = {
  release: "🎮",
  update: "🔄",
  esports: "🏆",
  industry: "💼",
  review: "📝",
  rumor: "🔮",
  deal: "💰",
  hardware: "🖥️",
  mobile: "📱",
  indie: "🎨",
  console: "🎮",
  pc: "💻",
  japanese: "🇯🇵",
  culture: "🎭",
  development: "🛠️",
  default: "📰",
};

export function getEmoji(category: string): string {
  return CATEGORY_EMOJI[category] || CATEGORY_EMOJI.default;
}

/** 文件级元数据 */
export interface DigestMeta {
  date: string;
  totalCount: number;
  topCount: number;
  generatedAt: string;
}

/** 条目级元数据 */
export interface ItemMeta {
  id: string;
  score: number;
  sourceCount: number;
  emoji: string;
  category: string;
  priority: "top" | "normal";
  tags: string[];
  link: string;
  source: string;
  chineseTitle: string;
  originalTitle?: string;
}

/** 解析后的摘要（用于主页卡片） */
export interface DigestSummary {
  date: string;
  totalCount: number;
  topCount: number;
  topThree: Array<{
    number: string;
    emoji: string;
    title: string;
    score: number;
  }>;
}

/** 解析后的详情条目（用于详情页） */
export interface DetailItem {
  number: string;
  meta: ItemMeta;
  title: string;
  article: string;
  priority: "top" | "normal";
}

/**
 * 解析单个 Markdown 文件
 */
export function parseDigestFile(mdPath: string): {
  meta: DigestMeta;
  items: DetailItem[];
} | null {
  if (!fs.existsSync(mdPath)) return null;

  const content = fs.readFileSync(mdPath, "utf-8");
  const date = path.basename(mdPath, ".md");

  // 1. 提取文件级元数据（兼容两种格式）
  const metaMatch = content.match(/<!-- (digest-meta|meta): (\{.+?\}) -->/s);
  let meta: DigestMeta = {
    date,
    totalCount: 0,
    topCount: 0,
    generatedAt: "",
  };
  if (metaMatch) {
    try {
      meta = { ...meta, ...JSON.parse(metaMatch[2]) };
    } catch {
      // 解析失败，使用默认值
    }
  }

  // 2. 提取所有条目级元数据
  const items: DetailItem[] = [];
  const itemRegex = /<!-- item: (\{.+?\}) -->\n(\d+)\.\s*([\u{1F300}-\u{1F9FF}]?)\s*\*{0,2}(.+?)\*{0,2}\n\n(.+?)(?=<!-- item:|## |---\n\n\*|$)/gsu;
  const itemMatches = content.matchAll(itemRegex);

  for (const match of itemMatches) {
    try {
      const itemJson = JSON.parse(match[1]);
      const num = match[2];
      const emoji = match[3] || "";
      const title = match[4].trim();
      const article = match[5].trim();

      items.push({
        number: num,
        meta: {
          id: `${date}-${num}`,
          score: itemJson.meta?.score ?? 80,
          sourceCount: itemJson.meta?.sourceCount ?? 1,
          emoji: emoji || itemJson.meta?.emoji || "📰",
          category: itemJson.meta?.category || "default",
          priority: itemJson.priority || "normal",
          tags: itemJson.meta?.tags || [],
          link: itemJson.meta?.link || "",
          source: itemJson.meta?.source || "",
          chineseTitle: itemJson.title || title,
        },
        title: itemJson.title || title,
        article: itemJson.article || article,
        priority: itemJson.priority || "normal",
      });
    } catch {
      // 解析失败，跳过
    }
  }

  // 如果没有从注释提取到条目，尝试从内容解析（兼容旧格式）
  if (items.length === 0) {
    const legacyItems = parseLegacyFormat(content, date);
    if (legacyItems.length > 0) {
      return { meta, items: legacyItems };
    }
  }

  return { meta, items };
}

/**
 * 兼容旧格式解析（无注释元数据）
 */
function parseLegacyFormat(content: string, date: string): DetailItem[] {
  const items: DetailItem[] = [];

  // 提取头条
  const headlineMatches = content.matchAll(/### ([\u{1F300}-\u{1F9FF}]) (.+?)\n\n(.+?)\n\n/gsu);
  let index = 0;
  for (const match of headlineMatches) {
    items.push({
      number: String(index + 1).padStart(2, "0"),
      meta: {
        id: `${date}-${index}`,
        score: 80,
        sourceCount: 1,
        emoji: match[1],
        category: "default",
        priority: "top",
        tags: [],
        link: "",
        source: "",
        chineseTitle: match[2].trim(),
      },
      title: match[2].trim(),
      article: match[3].trim(),
      priority: "top",
    });
    index++;
  }

  // 提取更多资讯
  const moreMatches = content.matchAll(/^- ([\u{1F300}-\u{1F9FF}]) \*\*(.+?)\**/gu);
  for (const match of moreMatches) {
    items.push({
      number: String(index + 1).padStart(2, "0"),
      meta: {
        id: `${date}-${index}`,
        score: 70,
        sourceCount: 1,
        emoji: match[1],
        category: "default",
        priority: "normal",
        tags: [],
        link: "",
        source: "",
        chineseTitle: match[2].trim(),
      },
      title: match[2].trim(),
      article: "",
      priority: "normal",
    });
    index++;
  }

  return items;
}

/**
 * 扫描 digests 目录，获取所有摘要（用于主页）
 */
export function scanDigestSummaries(digestsDir: string): DigestSummary[] {
  if (!fs.existsSync(digestsDir)) return [];

  const files = fs.readdirSync(digestsDir)
    .filter(f => f.endsWith(".md"))
    .sort()
    .reverse(); // 按日期倒序

  const summaries: DigestSummary[] = [];
  for (const file of files) {
    const parsed = parseDigestFile(path.join(digestsDir, file));
    if (!parsed) continue;

    // 取前 3 条作为摘要
    const topThree = parsed.items.slice(0, 3).map((item, i) => ({
      number: String(i + 1).padStart(2, "0"),
      emoji: item.meta.emoji || getEmoji(item.meta.category),
      title: item.title,
      score: item.meta.score,
    }));

    summaries.push({
      date: parsed.meta.date,
      totalCount: parsed.meta.totalCount || parsed.items.length,
      topCount: parsed.meta.topCount || parsed.items.filter(i => i.priority === "top").length,
      topThree,
    });
  }

  return summaries;
}

/**
 * 扫描 digests 目录，获取所有详情条目（用于详情页）
 */
export function scanAllDigests(digestsDir: string): Map<string, DetailItem[]> {
  if (!fs.existsSync(digestsDir)) return new Map();

  const files = fs.readdirSync(digestsDir)
    .filter(f => f.endsWith(".md"))
    .sort()
    .reverse();

  const allDigests = new Map<string, DetailItem[]>();
  for (const file of files) {
    const parsed = parseDigestFile(path.join(digestsDir, file));
    if (parsed && parsed.items.length > 0) {
      allDigests.set(parsed.meta.date, parsed.items);
    }
  }

  return allDigests;
}