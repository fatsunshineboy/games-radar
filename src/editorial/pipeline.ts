/**
 * 编辑部流程管线 - Editor → Writer → Reviewer
 */

import { loadConfig, getCallCount, saveJson } from "../llm.ts";
import { loadHistory } from "../history.ts";
import { getBeijingDate } from "../timezone.ts";
import { runEditor } from "./editor.ts";
import { runWriter } from "./writer.ts";
import { runReviewer } from "./reviewer.ts";
import type { NewsItem, FinalItem } from "../types.ts";

/** 运行完整编辑部流程 */
export async function runPipeline(items: NewsItem[]): Promise<FinalItem[]> {
  const cfg = loadConfig();
  const date = getBeijingDate();
  const lookbackDays = cfg.scoring.history_penalty.lookback_days;

  console.log(`\n📰 [editorial] 开始处理 ${items.length} 条资讯`);

  // 加载历史（前3天）
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

  // Phase 2: Writer 撰写摘要
  console.log("\n✍️  [Phase 2] Writer 撰写摘要...");
  const drafted = await runWriter(candidates);
  console.log(`  → 撰写 ${drafted.length} 条摘要`);
  saveJson(`data/${date}/drafted.json`, drafted);

  // Phase 3: Reviewer 审核
  console.log("\n🔎 [Phase 3] Reviewer 审核...");
  const final = await runReviewer(drafted, history);
  console.log(`  → 最终通过 ${final.length} 条`);
  saveJson(`data/${date}/final.json`, final);

  console.log(`\n📊 [editorial] 完成，LLM 调用 ${getCallCount()} 次`);

  return final;
}
