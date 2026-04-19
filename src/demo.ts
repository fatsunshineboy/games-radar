/**
 * Demo: 从 final.json 生成 digest MD + HTML
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FinalItem } from "./type/types.ts";
import { generateWeb } from "./web/index.ts";

const PROJECT_ROOT = path.resolve(
  import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DIGESTS_DIR = path.join(PROJECT_ROOT, "digests");

interface DemoItem {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceName: string;
  tier: number;
  category: string;
  sourceCount: number;
  finalScore: number;
  priority: string;
  chineseTitle: string;
  article: string;
  tags: string[];
}

function getEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    industry: "🎮",
    platform: "🖥️",
    game: "🎯",
    tech: "🔧",
    esports: "🏆",
    policy: "📜",
  };
  return emojiMap[category] || "📰";
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateDemo(date: string, items: DemoItem[]): void {
  // 确保 digests 目录存在
  fs.mkdirSync(DIGESTS_DIR, { recursive: true });

  const mdPath = path.join(DIGESTS_DIR, `${date}.md`);

  // 分离头条和普通
  const topItems = items.filter(i => i.priority === "top");
  const normalItems = items.filter(i => i.priority !== "top");

  // 元数据注释
  const metaComment = `<!-- meta: {"date": "${date}", "totalCount": ${items.length}, "topCount": ${topItems.length}} -->`;

  // 头条部分
  let topSection = "";
  if (topItems.length > 0) {
    topSection = "\n## 🔥 今日头条\n\n";
    topItems.forEach((item, idx) => {
      const emoji = getEmoji(item.category);
      const metaJson = JSON.stringify({
        number: idx + 1,
        priority: "top",
        title: item.chineseTitle,
        article: item.article,
        meta: {
          link: item.link,
          source: item.sourceName,
          sourceCount: item.sourceCount,
          score: item.finalScore,
          category: item.category,
          emoji,
          tags: item.tags,
        },
      });
      topSection += `<!-- item: ${metaJson} -->\n`;
      topSection += `${idx + 1}. ${emoji} **${escapeHtml(item.chineseTitle)}**\n\n`;
      topSection += `${item.article}\n\n`;
      if (item.tags.length > 0) {
        topSection += `标签：${item.tags.join("、")}\n\n`;
      }
      topSection += `[原文链接](${item.link}) | 来源：${item.sourceName}`;
      if (item.sourceCount > 1) {
        topSection += ` (${item.sourceCount}源报道)`;
      }
      topSection += ` | 评分：${item.finalScore.toFixed(1)}\n\n---\n\n`;
    });
  }

  // 普通资讯部分
  let normalSection = "";
  if (normalItems.length > 0) {
    normalSection = "\n## 📋 更多资讯\n\n";
    normalItems.forEach((item, idx) => {
      const num = topItems.length + idx + 1;
      const emoji = getEmoji(item.category);
      const metaJson = JSON.stringify({
        number: num,
        priority: "normal",
        title: item.chineseTitle,
        article: item.article,
        meta: {
          link: item.link,
          source: item.sourceName,
          sourceCount: item.sourceCount,
          score: item.finalScore,
          category: item.category,
          emoji,
          tags: item.tags,
        },
      });
      normalSection += `<!-- item: ${metaJson} -->\n`;
      normalSection += `${num}. ${emoji} **${escapeHtml(item.chineseTitle)}**\n\n`;
      normalSection += `${item.article}\n\n`;
      normalSection += `[原文链接](${item.link}) | 来源：${item.sourceName}`;
      if (item.sourceCount > 1) {
        normalSection += ` (${item.sourceCount}源报道)`;
      }
      normalSection += ` | 评分：${item.finalScore.toFixed(1)}\n\n---\n\n`;
    });
  }

  const mdContent = `# 游戏资讯精选 ${date}

${metaComment}

共精选 ${items.length} 条资讯，其中 ${topItems.length} 条头条。
${topSection}${normalSection}`;

  fs.writeFileSync(mdPath, mdContent, "utf-8");
  console.log(`📄 [demo] ${mdPath}`);

  // 调用 web 生成器
  generateWeb();
}

// 执行 demo
const date = "2026-04-19";
const jsonPath = path.join(DATA_DIR, date, "final.json");

if (fs.existsSync(jsonPath)) {
  const items = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as DemoItem[];
  console.log(`📊 读取 ${items.length} 条资讯`);
  generateDemo(date, items);
} else {
  console.log(`❌ 未找到 ${jsonPath}`);
}