/**
 * 编辑部流程管线 - Editor → Writer → Reviewer (循环修订) + 候补补充
 */

import { getCallCount } from "../utils/util_llm.ts";
import { saveJson } from "../utils/util_file.ts";
import { loadConfig } from "../utils/util_config.ts";
import { loadHistory } from "../utils/util_history.ts";
import { getBeijingDate } from "../utils/util_timezone.ts";
import { runEditor } from "./editor.ts";
import { runWriter } from "./writer.ts";
import { runReviewer } from "./reviewer.ts";
import type { NewsItem, FinalItem, DraftedItem, CandidateItem } from "../type/types.ts";

/** 运行完整编辑部流程 */
export async function runPipeline(items: NewsItem[]): Promise<FinalItem[]> {
  const cfg = loadConfig();
  const date = getBeijingDate();
  const lookbackDays = cfg.scoring.history_penalty.lookback_days;
  const maxRevisions = cfg.output.max_revisions;
  const maxItems = cfg.output.max_items;

  console.log(`\n📰 [editorial] 开始处理 ${items.length} 条资讯`);

  // 加载历史
  console.log(`📚 [editorial] 加载前 ${lookbackDays} 天历史...`);
  const history = loadHistory(lookbackDays);
  console.log(`  → 找到 ${history.length} 天历史数据`);

  // Phase 1: Editor 筛选打分
  console.log("\n🔍 [Phase 1] Editor 筛选打分...");
  const candidates = await runEditor(items, history);
  console.log(`  → 筛选出 ${candidates.length} 条候选`);
  saveJson(`data/${date}/candidates.json`, candidates);

  if (candidates.length === 0) {
    console.log("⚠️  编辑未筛选出任何内容");
    return [];
  }

  // 按分数排序，分批处理
  candidates.sort((a, b) => b.finalScore - a.finalScore);

  // 第一批 + 候补池
  const firstBatch = candidates.slice(0, maxItems);
  const reservePool = candidates.slice(maxItems);

  console.log(`  → 第一批 ${firstBatch.length} 条，候补池 ${reservePool.length} 条`);

  const passedItems: FinalItem[] = [];
  const rejectedItems: FinalItem[] = [];

  // 处理一批候选的完整 Writer → Reviewer 循环
  async function processBatch(batch: CandidateItem[], batchName: string): Promise<void> {
    if (batch.length === 0) return;

    console.log(`\n✍️  [${batchName}] Writer 撰写摘要...`);
    let drafted = await runWriter(batch);

    for (let round = 1; round <= maxRevisions; round++) {
      if (drafted.length === 0) break;

      console.log(`\n🔎  [${batchName}.R${round}] Reviewer 审核...`);
      const { passed, toRevise, rejected } = await runReviewer(drafted, history);

      passedItems.push(...passed);
      rejectedItems.push(...rejected);
      console.log(`  → 通过 ${passed.length}, 待修订 ${toRevise.length}, 拒绝 ${rejected.length}`);

      if (toRevise.length === 0) break;

      // 检查是否超次数
      const eligible: DraftedItem[] = [];
      for (const item of toRevise) {
        if (item.revisionCount >= maxRevisions - 1) {
          rejectedItems.push({
            ...item,
            reviewDecision: "reject",
            reviewReason: "超过最大修订次数",
            reviewSuggestions: "",
          });
          console.log(`  ⚠️ ${item.id}: 超过最大修订次数，丢弃`);
        } else {
          eligible.push(item);
        }
      }

      if (eligible.length === 0) break;

      console.log(`\n✍️  [${batchName}.R${round}] Writer 修订 (${eligible.length} 条)...`);
      drafted = await runWriter(eligible);
    }
  }

  // 处理第一批
  await processBatch(firstBatch, "Batch-1");

  // 候补循环：直到达到 max_items 或候补池耗尽
  let batchIndex = 2;
  while (passedItems.length < maxItems && reservePool.length > 0) {
    // 计算需要的数量（考虑可能被reject，取双倍）
    const need = Math.max(maxItems - passedItems.length, 1);
    const takeCount = Math.min(need * 2, reservePool.length);

    const nextBatch = reservePool.splice(0, takeCount);
    console.log(`\n🔄 [候补] 当前通过 ${passedItems.length}/${maxItems}，取候补 ${nextBatch.length} 条（剩余 ${reservePool.length}）`);

    await processBatch(nextBatch, `Batch-${batchIndex}`);
    batchIndex++;

    // 防止无限循环（最多补充 3 次）
    if (batchIndex > 4) {
      console.log(`  ⚠️ 候补次数已达上限，停止补充`);
      break;
    }
  }

  // 整合结果：按分数排序，取前 max_items
  const final = [...passedItems]
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, maxItems);

  console.log(`\n📊 [editorial] 完成：通过 ${final.length}/${maxItems} 条，拒绝 ${rejectedItems.length} 条，候补剩余 ${reservePool.length} 条，LLM 调用 ${getCallCount()} 次`);
  saveJson(`data/${date}/final.json`, final);
  saveJson(`data/${date}/rejected.json`, rejectedItems);

  return final;
}
