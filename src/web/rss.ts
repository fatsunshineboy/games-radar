/**
 * RSS Feed 生成器
 */

import fs from "node:fs";
import path from "node:path";
import type { DetailItem } from "./parser.ts";
import type { AppConfig } from "../type/types.ts";

export function generateRssFeed(
  items: DetailItem[],
  cfg: AppConfig,
  distDir: string
): void {
  const itemXml = items.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.meta.link)}</link>
      <guid>${escapeXml(item.meta.link)}</guid>
      <description>${escapeXml(item.article.slice(0, 200))}</description>
      <source>${escapeXml(item.meta.source)}</source>
      <category>${escapeXml(item.meta.category)}</category>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  `).join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(cfg.site.name_zh)}</title>
  <description>${escapeXml(cfg.site.description_zh)}</description>
  <link>${cfg.site.base_url || "/"}</link>
  <atom:link href="${cfg.site.base_url || ""}/feed.xml" rel="self" type="application/rss+xml"/>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${itemXml}
</channel>
</rss>`;

  fs.writeFileSync(path.join(distDir, "feed.xml"), rss, "utf-8");
  console.log(`📄 [web] ${distDir}/feed.xml`);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}