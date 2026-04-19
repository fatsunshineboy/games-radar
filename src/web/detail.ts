/**
 * 详情页生成器 - 单日完整资讯
 */

import fs from "node:fs";
import path from "node:path";
import type { DetailItem } from "./parser.ts";
import type { AppConfig } from "../type/types.ts";

export function generateDetailPage(
  date: string,
  items: DetailItem[],
  cfg: AppConfig,
  distDir: string
): void {
  // 分离头条和普通
  const topItems = items.filter(i => i.priority === "top");
  const normalItems = items.filter(i => i.priority !== "top");

  // 生成头条 HTML
  const topHtml = topItems.map(item => `
    <li class="digest-item">
      <div class="digest-number">${item.number}</div>
      <div class="digest-content">
        <h3 class="digest-title">
          <span class="priority-badge">头条</span>
          <a href="${escapeHtml(item.meta.link)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
        </h3>
        <p class="digest-article">${escapeHtml(item.article)}</p>
        <div class="digest-meta">
          <span class="digest-source">${escapeHtml(item.meta.source)}</span>
          ${item.meta.sourceCount > 1 ? `<span class="digest-multi">🔗 ${item.meta.sourceCount}源报道</span>` : ""}
          <span class="digest-score">⭐ ${item.meta.score.toFixed(1)}</span>
          <span class="digest-category">${item.meta.emoji} ${item.meta.category}</span>
        </div>
        ${item.meta.tags.length > 0 ? `
        <div class="digest-tags">
          ${item.meta.tags.map(t => `<span class="digest-tag">${escapeHtml(t)}</span>`).join("")}
        </div>
        ` : ""}
      </div>
    </li>
  `).join("");

  // 生成普通资讯 HTML
  const normalHtml = normalItems.map(item => `
    <li class="digest-item">
      <div class="digest-number">${item.number}</div>
      <div class="digest-content">
        <h3 class="digest-title">
          <a href="${escapeHtml(item.meta.link)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
        </h3>
        <p class="digest-article">${escapeHtml(item.article)}</p>
        <div class="digest-meta">
          <span class="digest-source">${escapeHtml(item.meta.source)}</span>
          ${item.meta.sourceCount > 1 ? `<span class="digest-multi">🔗 ${item.meta.sourceCount}源报道</span>` : ""}
          <span class="digest-score">⭐ ${item.meta.score.toFixed(1)}</span>
          <span class="digest-category">${item.meta.emoji} ${item.meta.category}</span>
        </div>
      </div>
    </li>
  `).join("");

  // 格式化日期
  const dateParts = date.split("-");
  const dateDisplay = `${dateParts[0]}年${dateParts[1]}月${dateParts[2]}日`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cfg.site.name_zh} - ${dateDisplay}</title>
<style>
${DETAIL_STYLES}
</style>
</head>
<body>
<div class="container">
<header>
<h1 class="site-name">${cfg.site.name_zh}</h1>
<p class="site-tagline">${cfg.site.description_zh}</p>
<p class="site-date">📅 ${dateDisplay}</p>
<nav>
<a href="../index.html">首页</a>
<a href="../methodology.html">方法论</a>
<a href="../feed.xml">RSS</a>
</nav>
</header>

${topItems.length > 0 ? `
<h2 class="section-title">🔥 今日头条</h2>
<ul class="digest-list">${topHtml}</ul>
` : ""}

${normalItems.length > 0 ? `
<hr class="section-divider">
<h2 class="section-title">📋 更多资讯</h2>
<ul class="digest-list">${normalHtml}</ul>
` : ""}

<footer>
<div class="footer-links">
<a href="../index.html">首页</a> ·
<a href="../methodology.html">方法论</a> ·
<a href="../feed.xml">RSS</a>
</div>
<p>由 ${cfg.site.name_zh} 自动生成 · 共 ${items.length} 条精选</p>
</footer>
</div>
</body>
</html>`;

  const pageDir = path.join(distDir, date);
  fs.mkdirSync(pageDir, { recursive: true });
  fs.writeFileSync(path.join(pageDir, "index.html"), html, "utf-8");
  console.log(`📄 [web] ${pageDir}/index.html`);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const DETAIL_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #faf9f7;
  color: #1a1a1a;
  line-height: 1.7;
}
.container { max-width: 720px; margin: 0 auto; padding: 24px; }

/* Header */
header { text-align: center; padding: 48px 0 32px; border-bottom: 1px solid #e8e4dc; }
.site-name { font-size: 1.6em; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
.site-tagline { color: #6b6b6b; font-size: 0.95em; margin-bottom: 12px; }
.site-date { font-size: 1.1em; color: #3a3a3a; margin-bottom: 12px; }
nav { display: flex; justify-content: center; gap: 24px; margin-top: 20px; font-size: 0.9em; }
nav a { color: #6b6b6b; text-decoration: none; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
nav a:hover { color: #1a1a1a; background: #f0ede6; }

/* Section */
.section-title { font-size: 1.2em; font-weight: 700; margin: 32px 0 16px; color: #1a1a1a; }
.section-divider { margin: 24px 0; border: none; border-top: 2px solid #e8e4dc; }

/* Digest List */
.digest-list { list-style: none; }
.digest-item {
  display: flex;
  gap: 16px;
  padding: 24px 0;
  border-bottom: 1px solid #f0ede6;
}
.digest-number { font-size: 1.4em; font-weight: 700; color: #c9a959; min-width: 32px; text-align: right; }
.digest-content { flex: 1; }
.digest-title { font-size: 1.05em; font-weight: 600; margin-bottom: 8px; line-height: 1.5; }
.digest-title a { color: #1a1a1a; text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.2s; }
.digest-title a:hover { border-bottom-color: #c9a959; }
.digest-article { font-size: 0.95em; color: #4a4a4a; margin-bottom: 8px; line-height: 1.7; }
.digest-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.82em; color: #8b8b8b; margin-top: 8px; }
.digest-source { background: #f0ede6; padding: 2px 8px; border-radius: 4px; }
.digest-multi { color: #c9a959; font-weight: 500; }
.digest-score { color: #c9a959; font-weight: 600; }
.digest-category { background: #f5f2eb; padding: 2px 8px; border-radius: 4px; }
.digest-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.digest-tag { background: #f5f2eb; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; color: #6b6b6b; }
.priority-badge { background: #c9a959; color: #fff; font-size: 0.75em; padding: 2px 8px; border-radius: 4px; margin-right: 8px; font-weight: 600; }

/* Footer */
footer { text-align: center; padding: 40px 0 20px; border-top: 1px solid #e8e4dc; margin-top: 48px; color: #8b8b8b; font-size: 0.85em; }
footer a { color: #6b6b6b; text-decoration: none; }
footer a:hover { color: #1a1a1a; }

@media (max-width: 600px) {
  .container { padding: 16px; }
  .digest-item { padding: 16px 0; gap: 12px; }
  .digest-number { font-size: 1.2em; min-width: 28px; }
}
`;