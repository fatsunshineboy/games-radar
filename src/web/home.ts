/**
 * 主页生成器 - 日期卡片列表
 */

import fs from "node:fs";
import path from "node:path";
import type { DigestSummary } from "./parser.ts";
import type { AppConfig } from "../type/types.ts";

export function generateHomePage(
  summaries: DigestSummary[],
  cfg: AppConfig,
  distDir: string
): void {
  // 生成卡片列表
  const cards = summaries.map(summary => {
    const itemsHtml = summary.topThree.map(item => `
      <li class="digest-item">
        <span class="digest-number">${item.number}</span>
        <span class="digest-emoji">${item.emoji}</span>
        <span class="digest-title">${escapeHtml(item.title)}</span>
      </li>
    `).join("");

    // 格式化日期显示
    const dateParts = summary.date.split("-");
    const dateDisplay = `${dateParts[0]}年${dateParts[1]}月${dateParts[2]}日`;

    return `
      <div class="digest-card">
        <div class="digest-date">📅 ${dateDisplay}</div>
        <div class="digest-meta">共 ${summary.totalCount} 条精选资讯 · ${summary.topCount} 条头条</div>
        <ul class="digest-items">${itemsHtml}</ul>
        <a href="${summary.date}/index.html" class="digest-link">查看详情 →</a>
      </div>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cfg.site.name_zh}</title>
<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml">
<style>
${COMMON_STYLES}

/* Date Card */
.digests-list { margin-top: 40px; }
.digest-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid #e8e4dc;
  transition: box-shadow 0.2s;
}
.digest-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.digest-date { font-size: 1.2em; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
.digest-meta { color: #8b8b8b; font-size: 0.85em; margin-bottom: 16px; }
.digest-items { list-style: none; }
.digest-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f2eb;
}
.digest-item:last-child { border-bottom: none; }
.digest-number { font-size: 0.9em; font-weight: 700; color: #c9a959; min-width: 24px; }
.digest-emoji { font-size: 1em; }
.digest-title { flex: 1; font-size: 0.95em; color: #3a3a3a; line-height: 1.5; }
.digest-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 16px;
  color: #c9a959;
  font-size: 0.9em;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s;
}
.digest-link:hover { color: #1a1a1a; }
</style>
</head>
<body>
<div class="container">
<header>
<h1 class="site-name">${cfg.site.name_zh}</h1>
<p class="site-tagline">${cfg.site.description_zh}</p>
<nav>
<a href="index.html">首页</a>
<a href="methodology.html">方法论</a>
<a href="feed.xml">RSS</a>
</nav>
</header>

<div class="digests-list">${cards}</div>

<footer>
<div class="footer-links">
<a href="index.html">首页</a> ·
<a href="methodology.html">方法论</a> ·
<a href="feed.xml">RSS</a>
</div>
<p>由 ${cfg.site.name_zh} 自动生成</p>
</footer>
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(distDir, "index.html"), html, "utf-8");
  console.log(`📄 [web] ${distDir}/index.html`);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const COMMON_STYLES = `
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
nav { display: flex; justify-content: center; gap: 24px; margin-top: 20px; font-size: 0.9em; }
nav a { color: #6b6b6b; text-decoration: none; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
nav a:hover { color: #1a1a1a; background: #f0ede6; }

/* Footer */
footer { text-align: center; padding: 40px 0 20px; border-top: 1px solid #e8e4dc; margin-top: 48px; color: #8b8b8b; font-size: 0.85em; }
footer a { color: #6b6b6b; text-decoration: none; }
footer a:hover { color: #1a1a1a; }
.footer-links { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.footer-links a { padding: 4px 8px; }

/* Responsive */
@media (max-width: 600px) {
  .container { padding: 16px; }
  .site-name { font-size: 1.3em; }
}
`;