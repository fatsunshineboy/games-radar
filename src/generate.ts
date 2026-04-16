/**
 * 页面生成器 - 静态站点 + Markdown 日报
 */

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./llm.ts";
import { getBeijingTimestamp, getDateParts } from "./timezone.ts";
import type { FinalItem } from "./types.ts";

/** 分类 emoji 映射 */
const CATEGORY_EMOJI: Record<string, string> = {
  release: "🎮", update: "🔄", esports: "🏆", industry: "💼",
  review: "📝", rumor: "🔮", deal: "💰", hardware: "🖥️",
  mobile: "📱", indie: "🎨", default: "📰",
};

function getEmoji(category: string): string {
  return CATEGORY_EMOJI[category] || CATEGORY_EMOJI.default;
}

/** 生成 HTML 静态站点 */
export function generateSite(items: FinalItem[], date: string): void {
  const cfg = loadConfig();
  const { year, month, day } = getDateParts(date);
  const topItems = items.filter(i => i.priority === "top");
  const normalItems = items.filter(i => i.priority !== "top");

  const cardHtml = (item: FinalItem) => `
    <article class="card ${item.priority === "top" ? "card--top" : ""}">
      <div class="card__meta">
        <span class="card__emoji">${getEmoji(item.category)}</span>
        <span class="card__category">${item.category}</span>
        <span class="card__source">${item.sourceName}</span>
        ${item.sourceCount > 1 ? `<span class="card__multi">🔗 ${item.sourceCount}源</span>` : ""}
      </div>
      <h3 class="card__title">
        <a href="${item.link}" target="_blank" rel="noopener">${item.chineseTitle}</a>
      </h3>
      <p class="card__original">${item.title}</p>
      <p class="card__fact">${item.analysis.fact}</p>
      ${item.analysis.importance ? `<p class="card__importance">💡 ${item.analysis.importance}</p>` : ""}
      <div class="card__tags">${item.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
      <div class="card__score">⭐ ${item.finalScore.toFixed(1)}</div>
    </article>`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cfg.site.name_zh} - ${date}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f0e8;color:#2c2c2c;line-height:1.6}
.container{max-width:800px;margin:0 auto;padding:20px}
header{text-align:center;padding:40px 0 20px;border-bottom:2px solid #8b7355}
h1{font-size:1.8em;color:#4a3728;font-weight:700}
.subtitle{color:#8b7355;margin-top:8px;font-size:0.95em}
.date{font-size:1.1em;color:#6b5b4a;margin-top:4px}
.section-title{font-size:1.3em;color:#4a3728;margin:30px 0 15px;padding-bottom:8px;border-bottom:1px solid #d4c5a9}
.card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:3px solid #d4c5a9;transition:transform 0.2s}
.card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.1)}
.card--top{border-left-color:#c9a959;background:#fffdf5}
.card__meta{display:flex;gap:8px;align-items:center;font-size:0.85em;color:#8b7355;margin-bottom:8px;flex-wrap:wrap}
.card__emoji{font-size:1.2em}
.card__category{background:#f0e8d8;padding:2px 8px;border-radius:4px}
.card__multi{color:#c9a959;font-weight:600}
.card__title{font-size:1.1em;margin-bottom:6px}
.card__title a{color:#2c2c2c;text-decoration:none;border-bottom:1px solid transparent}
.card__title a:hover{color:#8b5e3c;border-bottom-color:#8b5e3c}
.card__original{font-size:0.85em;color:#999;margin-bottom:8px;font-style:italic}
.card__fact{font-size:0.95em;color:#4a4a4a;margin-bottom:8px}
.card__importance{font-size:0.9em;color:#6b5b4a;background:#f8f4ec;padding:6px 10px;border-radius:4px;margin-bottom:8px}
.card__tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.tag{font-size:0.8em;background:#e8e0d0;color:#6b5b4a;padding:2px 8px;border-radius:12px}
.card__score{font-size:0.8em;color:#c9a959;text-align:right}
footer{text-align:center;padding:30px 0;color:#8b7355;font-size:0.85em;border-top:1px solid #d4c5a9;margin-top:30px}
@media(max-width:600px){.container{padding:12px}h1{font-size:1.4em}.card{padding:14px}}
</style>
</head>
<body>
<div class="container">
<header>
<h1>${cfg.site.name_zh}</h1>
<p class="subtitle">${cfg.site.description_zh}</p>
<p class="date">📅 ${year}年${month}月${day}日</p>
</header>
${topItems.length > 0 ? `<h2 class="section-title">🔥 今日头条</h2>${topItems.map(cardHtml).join("")}` : ""}
${normalItems.length > 0 ? `<h2 class="section-title">📋 更多资讯</h2>${normalItems.map(cardHtml).join("")}` : ""}
<footer>
<p>由 ${cfg.site.name_zh} 自动生成 · ${getBeijingTimestamp()}</p>
<p>共收录 ${items.length} 条精选资讯</p>
</footer>
</div>
</body>
</html>`;

  const dir = `dist/${date}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
  console.log(`📄 [generate] dist/${date}/index.html`);

  // 同时复制到 dist/index.html 作为最新版
  fs.writeFileSync("dist/index.html", html, "utf-8");
}

/** 生成 Markdown 日报 */
export function generateDigest(items: FinalItem[], date: string): void {
  const cfg = loadConfig();
  const { year, month, day } = getDateParts(date);
  const topItems = items.filter(i => i.priority === "top");
  const normalItems = items.filter(i => i.priority !== "top");

  let md = `# ${cfg.site.name_zh} - ${year}年${month}月${day}日\n\n`;
  md += `> ${cfg.site.description_zh}\n\n`;

  if (topItems.length > 0) {
    md += `## 🔥 今日头条\n\n`;
    for (const item of topItems) {
      md += `### ${getEmoji(item.category)} ${item.chineseTitle}\n\n`;
      md += `> ${item.title}\n\n`;
      md += `${item.analysis.fact}\n\n`;
      if (item.analysis.importance) md += `💡 ${item.analysis.importance}\n\n`;
      md += `🔗 [原文](${item.link}) · 来源: ${item.sourceName}`;
      if (item.sourceCount > 1) md += ` · ${item.sourceCount}源报道`;
      md += ` · ⭐ ${item.finalScore.toFixed(1)}\n\n`;
      if (item.tags.length > 0) md += `标签: ${item.tags.map(t => `\`${t}\``).join(" ")}\n\n`;
      md += `---\n\n`;
    }
  }

  if (normalItems.length > 0) {
    md += `## 📋 更多资讯\n\n`;
    for (const item of normalItems) {
      md += `- ${getEmoji(item.category)} **${item.chineseTitle}** - ${item.analysis.fact} [原文](${item.link}) ⭐${item.finalScore.toFixed(1)}\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*由 ${cfg.site.name_zh} 自动生成 · 共 ${items.length} 条精选*\n`;

  // 保存到 digests 目录
  const digestDir = "digests";
  fs.mkdirSync(digestDir, { recursive: true });
  fs.writeFileSync(path.join(digestDir, `${date}.md`), md, "utf-8");
  console.log(`📝 [generate] digests/${date}.md`);

  // 也保存到 dist
  const distDir = `dist/${date}`;
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, "digest.md"), md, "utf-8");
}
