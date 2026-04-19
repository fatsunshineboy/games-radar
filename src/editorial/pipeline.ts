/**
 * 编辑部流程管线 - Editor → Writer → Reviewer (循环修订)
 */

import { getCallCount } from "../utils/util_llm.ts";
import { saveJson } from "../utils/util_file.ts";
import { loadConfig } from "../utils/util_config.ts";
import { loadHistory } from "../utils/util_history.ts";
import { getBeijingDate } from "../utils/util_timezone.ts";
import { runEditor } from "./editor.ts";
import { runWriter } from "./writer.ts";
import { runReviewer } from "./reviewer.ts";
import type { NewsItem, FinalItem, DraftedItem } from "../type/types.ts";

/** 运行完整编辑部流程 */
export async function runPipeline(items: NewsItem[]): Promise<FinalItem[]> {
  const cfg = loadConfig();
  const date = getBeijingDate();
  const lookbackDays = cfg.scoring.history_penalty.lookback_days;
  const maxRevisions = cfg.output.max_revisions;

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

  // Phase 2-3: Writer → Reviewer 循环
  console.log("\n✍️  [Phase 2] Writer 撰写摘要...");
  let drafted = await runWriter(candidates);
  saveJson(`data/${date}/drafted_round0.json`, drafted);

  const passedItems: FinalItem[] = [];
  const rejectedItems: FinalItem[] = [];

  for (let round = 1; round <= maxRevisions; round++) {
    console.log(`\n🔎 [Phase 3.${round}] Reviewer 审核 (第 ${round} 次)...`);
    const { passed, toRevise, rejected } = await runReviewer(drafted, history);

    // 收集通过和拒绝的
    passedItems.push(...passed);
    rejectedItems.push(...rejected);
    console.log(`  → 通过 ${passed.length}, 待修订 ${toRevise.length}, 拒绝 ${rejected.length}`);

    if (toRevise.length === 0) break;

    // 检查是否超次数（修订前已超 maxRevisions-1 的条目直接丢弃）
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

    // 重写
    console.log(`\n✍️  [Phase 2.${round}] Writer 修订 (${eligible.length} 条)...`);
    drafted = await runWriter(eligible);
    saveJson(`data/${date}/drafted_round${round}.json`, drafted);
  }

  // 整合结果：按优先级和分数排序
  const final = [...passedItems]
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "top" ? -1 : 1;
      return b.finalScore - a.finalScore;
    })
    .slice(0, cfg.output.max_items);

  console.log(`\n📊 [editorial] 完成：通过 ${final.length} 条，拒绝 ${rejectedItems.length} 条，LLM 调用 ${getCallCount()} 次`);
  saveJson(`data/${date}/final.json`, final);
  saveJson(`data/${date}/rejected.json`, rejectedItems);

  return final;
}
