/**
 * Manifest 生成器 - 生成前端索引文件
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanDigestSummaries } from "./parser.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DIGESTS_DIR = path.join(PROJECT_ROOT, "digests");

export interface ManifestEntry {
  date: string;
  totalCount: number;
  topCount: number;
  topThree: Array<{
    number: string;
    emoji: string;
    title: string;
    article: string;
    score: number;
  }>;
}

export interface Manifest {
  generated: string;
  site: {
    name: string;
    name_zh: string;
    description_zh: string;
  };
  dates: ManifestEntry[];
}

/**
 * 生成 manifest.json
 */
export function generateManifest(): void {
  console.log("\n📋 [manifest] 开始生成索引...");

  const summaries = scanDigestSummaries(DIGESTS_DIR);

  if (summaries.length === 0) {
    console.log("⚠️  [manifest] 没有找到任何 digest 文件");
    return;
  }

  // 获取文章预览（取第一段落或前300字符）
  const dates: ManifestEntry[] = summaries.map(summary => ({
    date: summary.date,
    totalCount: summary.totalCount,
    topCount: summary.topCount,
    topThree: summary.topThree.map(item => {
      // 取第一段落（以双换行分隔）或前300字符
      const firstPara = item.article.split('\n\n')[0] || item.article;
      const preview = firstPara.length > 300 ? firstPara.slice(0, 300) : firstPara;
      return {
        ...item,
        article: preview,
      };
    }),
  }));

  const manifest: Manifest = {
    generated: new Date().toISOString(),
    site: {
      name: "Game Radar",
      name_zh: "🎮 游戏速报",
      description_zh: "游戏资讯每日简报",
    },
    dates,
  };

  // 写入 manifest.json
  const manifestPath = path.join(PROJECT_ROOT, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`📋 [manifest] ${manifestPath}`);
  console.log(`📋 [manifest] 完成：${dates.length} 份日报索引\n`);
}