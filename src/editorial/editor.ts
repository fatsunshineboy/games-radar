/**
 * 编辑智能体 - 筛选、评分、分类（分批处理）
 */

import { callLlm, parseJson } from "../utils/util_llm.ts";
import { loadConfig, loadPrompts } from "../utils/util_config.ts";
import { calcFinalScore, enforceDiversity } from "../utils/util_scoring.ts";
import { formatHistoryForPrompt } from "../utils/util_history.ts";
import { parallelWithRetry } from "../utils/util_concurrency.ts";
import { titleSimilarity } from "../utils/util_similarity.ts";
import type { NewsItem, CandidateItem, ScoreBreakdown, HistorySummary } from "../type/types.ts";

interface EditorOutput {
  candidates: Array<{
    id: string;
    base_score: number;
    score_breakdown: {
      influence: number;
      audience: number;
      scarcity: number;
      followup: number;
      actionable: number;
    };
    category: string;
    reason: string;
    duplicate_of: string | null;
  }>;
}

/** 处理单批次资讯 */
async function runEditorBatch(
  batch: NewsItem[],
  prompts: { system: string; user: string },
  history: HistorySummary[],
  batchIndex: number
): Promise<CandidateItem[]> {
  const cfg = loadConfig();
  const threshold = cfg.deduplication.similarity_threshold;

  // 历史标题列表（英文原标题）
  const historyTitles = history.flatMap(h => h.titles);

  // 过滤与历史相似的条目（节省LLM token）
  const filteredBatch: NewsItem[] = [];
  for (const item of batch) {
    let maxSim = 0;
    for (const histTitle of historyTitles) {
      if (histTitle) {
        const sim = titleSimilarity(item.title, histTitle);
        if (sim > maxSim) maxSim = sim;
      }
    }
    if (maxSim >= threshold) {
      console.log(`  ⏭️  [editor] ${item.id}: 历史相似度 ${maxSim.toFixed(2)} >= ${threshold}，跳过`);
      continue;
    }
    filteredBatch.push(item);
  }

  if (filteredBatch.length === 0) {
    console.log(`  🤖 [editor] 批次 ${batchIndex + 1}: 全部与历史重复，跳过LLM`);
    return [];
  }

  // 构建输入数据（精简版）
  const itemsJson = filteredBatch.map(i => ({
    id: i.id,
    title: i.title,
    source: i.sourceName,
    source_count: i.sourceCount,
    tier: i.tier,
    category: i.category,
    description: i.description,
    content_preview: i.content.slice(0, 300),
    timestamp: i.timestamp,
  }));

  let userPrompt = prompts.user
    .replace("{{item_count}}", String(filteredBatch.length))
    .replace("{{items}}", JSON.stringify(itemsJson, null, 2));

  // 添加历史摘要
  const historyText = formatHistoryForPrompt(history);
  if (historyText) {
    userPrompt = userPrompt.replace("{{#if history}}", "").replace("{{/if}}", "")
      .replace("{{history}}", historyText);
  } else {
    userPrompt = userPrompt.replace(/\{\{#if history\}\}[\s\S]*?\{\{\/if\}\}/g, "");
  }

  console.log(`  🤖 [editor] 批次 ${batchIndex + 1}: ${filteredBatch.length}/${batch.length} 条资讯（已过滤 ${batch.length - filteredBatch.length} 条重复）...`);
  const response = await callLlm(prompts.system, userPrompt);
  const output = parseJson<EditorOutput>(response);

  // 合并回原数据，计算最终分数
  const candidates: CandidateItem[] = [];

  for (const c of output.candidates) {
    if (c.duplicate_of) {
      console.log(`  ⏭️  [editor] ${c.id}: 重复 → ${c.duplicate_of}`);
      continue;
    }

    const original = filteredBatch.find(i => i.id === c.id);
    if (!original) continue;

    const breakdown: ScoreBreakdown = {
      influence: c.score_breakdown.influence,
      audience: c.score_breakdown.audience,
      scarcity: c.score_breakdown.scarcity,
      followup: c.score_breakdown.followup,
      actionable: c.score_breakdown.actionable,
    };

    const scores = calcFinalScore(c.base_score, breakdown, original, history);

    candidates.push({
      ...original,
      baseScore: c.base_score,
      scoreBreakdown: breakdown,
      breakdownTotal: scores.breakdownTotal,
      tierBonus: scores.tierBonus,
      crossBonus: scores.crossBonus,
      freshnessBonus: scores.freshnessBonus,
      historyPenalty: scores.historyPenalty,
      finalScore: scores.finalScore,
      reason: c.reason,
      category: c.category || original.category,
    });
  }

  return candidates;
}

/** 运行编辑智能体（分批并行处理） */
export async function runEditor(
  items: NewsItem[],
  history: HistorySummary[]
): Promise<CandidateItem[]> {
  const prompts = loadPrompts();
  const cfg = loadConfig();
  const batchSize = cfg.concurrency.editor_batch_size;
  const concurrency = cfg.concurrency.editor_batch;

  console.log(`  📊 [editor] 总计 ${items.length} 条资讯，分批处理（并行 ${concurrency}）...`);

  // 分批
  const batches: NewsItem[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  // 并行处理批次
  const batchResults = await parallelWithRetry(
    batches,
    concurrency,
    (batch, index) => runEditorBatch(batch, prompts.editor, history, index)
  );

  const allCandidates = batchResults.flat();
  console.log(`  📊 [editor] 所有批次完成，共筛选出 ${allCandidates.length} 条候选`);

  // 确保领域多样性
  const diverse = enforceDiversity(allCandidates, cfg.output.max_per_category);

  // 按分数排序，前 top_count 为头条，后 normal_count 为要闻
  diverse.sort((a, b) => b.finalScore - a.finalScore);

  // 限制数量
  const topItems = diverse.slice(0, cfg.output.top_count);
  const normalItems = diverse.slice(cfg.output.top_count, cfg.output.top_count + cfg.output.normal_count);

  const result = [...topItems, ...normalItems];

  console.log(`  📋 [editor] 最终筛选出 ${result.length} 条 (前${topItems.length}条头条 + 后${normalItems.length}条要闻)`);
  console.log(`  💰 [editor] LLM 调用 ${batches.length} 次（分批并行）`);

  return result;
}