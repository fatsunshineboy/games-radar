/**
 * 主入口 - 收集 → 编辑 → 生成
 */

import { collect, saveRawData } from "./rss.ts";
import { runPipeline } from "./editorial/pipeline.ts";
import { generateSite, generateDigest } from "./generate.ts";
import type { RawData } from "./types.ts";
import type { FinalItem } from "./types.ts";

async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("游戏雷达 - 海外游戏资讯每日简报");
  console.log("=".repeat(50));

  // Phase 1: 收集
  console.log("\n[Phase 1] 收集RSS数据...");
  const rawData: RawData = await collect();
  saveRawData(rawData);

  if (rawData.items.length === 0) {
    console.log("没有收集到数据，退出");
    return;
  }

  // Phase 2: 编辑流程
  console.log("\n[Phase 2] 编辑部流程...");
  const finalItems: FinalItem[] = await runPipeline(rawData.items);

  if (finalItems.length === 0) {
    console.log("没有筛选出内容，退出");
    return;
  }

  // Phase 3: 生成页面
  console.log("\n[Phase 3] 生成页面...");
  generateSite(finalItems, rawData.date);
  generateDigest(finalItems, rawData.date);

  console.log("\n" + "=".repeat(50));
  console.log(`完成！收集 ${rawData.items.length} 条，精选 ${finalItems.length} 条`);
  console.log(`HTML: dist/${rawData.date}/index.html`);
  console.log(`MD:   digests/${rawData.date}.md`);
  console.log("=".repeat(50));
}

main().catch((err: unknown) => {
  console.error("错误:", err);
  process.exit(1);
});
