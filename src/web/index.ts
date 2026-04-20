/**
 * Web 生成器主入口
 *
 * 每次部署扫描 digests/*.md，为所有历史日期生成详情页
 * 不依赖单独的 final.json，所有元数据嵌入 Markdown 注释
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../utils/util_config.ts";
import { scanDigestSummaries, scanAllDigests, getEmoji } from "./parser.ts";
import { generateHomePage } from "./home.ts";
import { generateDetailPage } from "./detail.ts";
import { generateMethodologyPage } from "./methodology.ts";
import { generateRssFeed } from "./rss.ts";

const PROJECT_ROOT = path.resolve(
  import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url)),
  "..", ".."
);
const DIGESTS_DIR = path.join(PROJECT_ROOT, "digests");
const DIST_DIR = path.join(PROJECT_ROOT, "dist");

/**
 * 生成所有静态页面
 *
 * 流程：
 * 1. 扫描 digests/*.md → 获取所有日期的摘要和详情
 * 2. 生成主页（index.html）- 所有日期卡片，每个显示前3条
 * 3. 为每个日期生成详情页（[日期]/index.html）
 * 4. 生成方法论页、RSS
 */
export function generateWeb(): void {
  const cfg = loadConfig();

  console.log("\n🌐 [web] 开始生成静态页面...");

  // 确保 dist 目录存在
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 1. 扫描所有 digest md 文件
  const summaries = scanDigestSummaries(DIGESTS_DIR);
  const allDigests = scanAllDigests(DIGESTS_DIR);

  if (summaries.length === 0) {
    console.log("⚠️  [web] 没有找到任何 digest 文件");
    return;
  }

  console.log(`  → 找到 ${summaries.length} 份日报`);

  // 2. 生成主页
  generateHomePage(summaries, cfg, DIST_DIR);

  // 3. 为每个日期生成详情页
  let pageCount = 1;
  for (const [date, items] of allDigests) {
    generateDetailPage(date, items, cfg, DIST_DIR);
    pageCount++;

    // 复制 md 文件到 dist
    const mdSource = path.join(DIGESTS_DIR, `${date}.md`);
    const mdDest = path.join(DIST_DIR, date, "digest.md");
    if (fs.existsSync(mdSource)) {
      fs.mkdirSync(path.dirname(mdDest), { recursive: true });
      fs.copyFileSync(mdSource, mdDest);
    }
  }

  // 4. 生成方法论页面（静态，首次或更新时）
  generateMethodologyPage(cfg, DIST_DIR);

  // 5. 生成 RSS Feed（最新 20 条头条）
  const topCount = cfg.output.top_count;
  const latestItems = Array.from(allDigests.values())
    .flat()
    .slice(0, topCount * 10)
    .slice(0, 20);
  generateRssFeed(latestItems, cfg, DIST_DIR);

  console.log(`🌐 [web] 完成：主页 + ${summaries.length} 详情页 + RSS + 方法论\n`);
}