/**
 * 页面生成器入口
 *
 * 流程：
 * 1. generateMarkdownDigest() → digests/${date}.md（带元数据注释）
 * 2. generateWeb() → 扫描所有 md，生成所有 HTML 页面
 */

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./utils/util_config.ts";
import { getBeijingDate, getDateParts } from "./utils/util_timezone.ts";
import { generateWeb } from "./web/index.ts";
import { getEmoji } from "./web/parser.ts";
import { saveJson } from "./utils/util_file.ts";
import type { FinalItem } from "./type/types.ts";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const DIGESTS_DIR = path.join(PROJECT_ROOT, "digests");

/**
 * 生成 Markdown 日报 + 静态页面
 */
export function generate(
  date: string,
  items: FinalItem[]
): void {
  // 1. 生成 Markdown 日报（带元数据注释）
  generateMarkdownDigest(date, items);

  // 2. 保存 final.json（供后续解析使用）
  const dataDir = path.join(PROJECT_ROOT, "data", date);
  saveJson(path.join(dataDir, "final.json"), items);

  // 3. 生成静态 Web 页面（扫描所有历史 md）
  generateWeb();
}

/**
 * 生成 Markdown 日报（嵌入元数据注释）
 */
function generateMarkdownDigest(
  date: string,
  items: FinalItem[]
): void {
  const cfg = loadConfig();
  const { year, month, day } = getDateParts(date);
  // 按分数排序：前 top_count 为头条，其余为要闻
  const topItems = items.slice(0, cfg.output.top_count);
  const normalItems = items.slice(cfg.output.top_count, cfg.output.top_count + cfg.output.normal_count);

  // 文件级元数据
  const fileMeta = {
    date,
    totalCount: items.length,
    topCount: topItems.length,
    generatedAt: new Date().toISOString(),
  };

  let md = `<!-- digest-meta: ${JSON.stringify(fileMeta)} -->\n\n`;
  md += `# ${cfg.site.name_zh} - ${year}年${month}月${day}日\n\n`;
  md += `> ${cfg.site.description_zh}\n\n`;

  // 今日头条
  if (topItems.length > 0) {
    md += `## 🔥 今日头条\n\n`;
    for (const item of topItems) {
      // 条目级元数据注释
      const itemMeta = {
        id: item.id,
        score: item.finalScore,
        sourceCount: item.sourceCount,
        emoji: getEmoji(item.category),
        category: item.category,
        tags: item.tags,
        link: item.link,
        source: item.sourceName,
        chineseTitle: item.chineseTitle,
        originalTitle: item.title,
        article: item.article
      };
      md += `<!-- item: ${JSON.stringify(itemMeta)} -->\n`;

      md += `### ${getEmoji(item.category)} ${item.chineseTitle}\n\n`;
      md += `${item.article}\n\n`;

      md += `💡 **重要性分析**：${item.article.includes("💡") ? "" : "对行业/玩家有一定影响"}\n\n`;

      md += `🔗 [原文](${item.link}) · 来源：${item.sourceName}`;
      if (item.sourceCount > 1) md += ` · ${item.sourceCount}源报道`;
      md += ` · ⭐ ${item.finalScore.toFixed(1)}\n\n`;

      if (item.tags.length > 0) {
        md += `标签：${item.tags.map(t => `\`${t}\``).join(" ")}\n\n`;
      }
      md += `---\n\n`;
    }
  }

  // 更多资讯
  if (normalItems.length > 0) {
    md += `## 📋 更多资讯\n\n`;
    for (const item of normalItems) {
      // 条目级元数据注释
      const itemMeta = {
        id: item.id,
        score: item.finalScore,
        sourceCount: item.sourceCount,
        emoji: getEmoji(item.category),
        category: item.category,
        tags: item.tags,
        link: item.link,
        source: item.sourceName,
        chineseTitle: item.chineseTitle,
        article: item.article
      };
      md += `<!-- item: ${JSON.stringify(itemMeta)} -->\n`;

      const preview = item.article;
      md += `- ${getEmoji(item.category)} **${item.chineseTitle}** - ${preview} [原文](${item.link}) ⭐${item.finalScore.toFixed(1)}\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*由 ${cfg.site.name_zh} 自动生成 · 共 ${items.length} 条精选*\n`;

  // 保存到 digests 目录
  fs.mkdirSync(DIGESTS_DIR, { recursive: true });
  const mdPath = path.join(DIGESTS_DIR, `${date}.md`);
  fs.writeFileSync(mdPath, md, "utf-8");
  console.log(`📝 [digest] digests/${date}.md`);
}