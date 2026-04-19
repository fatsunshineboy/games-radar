/**
 * 主入口 - 收集 → 编辑 → 生成
 */

import { collect, saveRawData } from "./rss.ts";
import { runPipeline } from "./editorial/pipeline.ts";
import { generateSite, generateDigest } from "./generate.ts";
import type { RawData } from "./type/types.ts";
import type { FinalItem } from "./type/types.ts";

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("🎮 看点啥 (See Something)");
  console.log("📰 游戏资讯每日简报");
  console.log("=".repeat(60));

  try {
    // Phase 1: 收集
    console.log("📡 [Phase 1] 收集 RSS 数据...");
    const rawData: RawData = await collect();
    saveRawData(rawData);

    if (rawData.items.length === 0) {
      console.log("⚠️  没有收集到内容，退出");
      console.log();
      console.log("💡 可能原因：");
      console.log("   - 所有 RSS 源都不可用");
      console.log("   - 网络连接问题");
      console.log("   - 源配置有误");
      return;
    }

    console.log(`✅ 收集完成：${rawData.items.length} 条资讯`);
    console.log();

    // Phase 2: 编辑流程
    console.log("🤖 [Phase 2] 编辑部流程...");
    console.log("   - Editor: 筛选打分");
    console.log("   - Writer: 翻译撰写");
    console.log("   - Reviewer: 审核把关");
    console.log();
    
    const finalItems: FinalItem[] = await runPipeline(rawData.items);

    if (finalItems.length === 0) {
      console.log("⚠️  没有内容通过审核，退出");
      console.log();
      console.log("💡 可能原因：");
      console.log("   - 所有内容都被判定为重复");
      console.log("   - 质量审核未通过");
      console.log("   - LLM 调用失败");
      return;
    }

    console.log(`✅ 编辑完成：${finalItems.length} 条精选`);
    console.log();

    // Phase 3: 生成页面
    // console.log("🎨 [Phase 3] 生成页面...");
    // generateSite(finalItems, rawData.date);
    // generateDigest(finalItems, rawData.date);

    // console.log();
    // console.log("=".repeat(60));
    // console.log("✨ 生成完成！");
    // console.log();
    // console.log(`📊 数据统计:`);
    // console.log(`   - 收集：${rawData.items.length} 条`);
    // console.log(`   - 精选：${finalItems.length} 条`);
    // console.log(`   - 入选率：${((finalItems.length / rawData.items.length) * 100).toFixed(1)}%`);
    // console.log();
    // console.log(`📁 输出文件:`);
    // console.log(`   - HTML: dist/${rawData.date}/index.html`);
    // console.log(`   - MD:   digests/${rawData.date}.md`);
    // console.log(`   - 存档：dist/archive.html`);
    // console.log(`   - 方法论：dist/methodology.html`);
    // console.log(`   - RSS:  dist/feed.xml`);
    // console.log("=".repeat(60));
  } catch (error) {
    console.error();
    console.error("❌ 发生错误:");
    console.error("=".repeat(60));
    
    if (error instanceof Error) {
      console.error(`错误类型：${error.constructor.name}`);
      console.error(`错误信息：${error.message}`);
      console.error();
      console.error("堆栈跟踪:");
      console.error(error.stack);
    } else {
      console.error(error);
    }
    
    console.error();
    console.error("💡 排查建议:");
    console.error("   1. 检查网络连接");
    console.error("   2. 检查 API 密钥配置");
    console.error("   3. 检查 YAML 配置文件格式");
    console.error("   4. 查看上述错误信息");
    console.error("=".repeat(60));
    
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("❌ 未捕获的错误:", err);
  process.exit(1);
});
