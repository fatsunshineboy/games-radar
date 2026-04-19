/**
 * 编辑智能体 - 筛选、评分、分类
 */

import { callLlm, parseJson } from "../utils/util_llm.ts";
import { loadConfig,loadPrompts } from "../utils/util_config.ts";
import { calcFinalScore, enforceDiversity } from "../scoring.ts";
import { formatHistoryForPrompt } from "../utils/util_history.ts";
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
    priority: "top" | "normal";
    duplicate_of: string | null;
  }>;
}

/** 运行编辑智能体 */
export async function runEditor(
  items: NewsItem[],
  history: HistorySummary[]
): Promise<CandidateItem[]> {
  const prompts = loadPrompts();
  const cfg = loadConfig();

  // 构建输入数据（精简版，减少 token）
  const itemsJson = items.map(i => ({
    id: i.id,
    title: i.title,
    source: i.sourceName,
    source_count: i.sourceCount,
    tier: i.tier,
    category: i.category,
    content_preview: i.content.slice(0, 300),
    timestamp: i.timestamp,
  }));

  // 构建 user prompt
  let userPrompt = prompts.editor.user
    .replace("{{item_count}}", String(items.length))
    .replace("{{items}}", JSON.stringify(itemsJson, null, 2));

  // 添加历史摘要
  const historyText = formatHistoryForPrompt(history);
  if (historyText) {
    userPrompt = userPrompt.replace("{{#if history}}", "").replace("{{/if}}", "")
      .replace("{{history}}", historyText);
  } else {
    // 移除历史部分
    userPrompt = userPrompt.replace(/\{\{#if history\}\}[\s\S]*?\{\{\/if\}\}/g, "");
  }

  console.log("  🤖 [editor] 调用 LLM 进行筛选评分...");
  const response = await callLlm(prompts.editor.system, userPrompt);
  const output = parseJson<EditorOutput>(response);

  // 合并回原数据，计算最终分数
  const candidates: CandidateItem[] = [];

  for (const c of output.candidates) {
    // 跳过标记为重复的
    if (c.duplicate_of) {
      console.log(`  ⏭️  [editor] ${c.id}: 重复 → ${c.duplicate_of}`);
      continue;
    }

    const original = items.find(i => i.id === c.id);
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
      tierBonus: scores.tierBonus,
      crossBonus: scores.crossBonus,
      freshnessBonus: scores.freshnessBonus,
      historyPenalty: scores.historyPenalty,
      finalScore: scores.finalScore,
      reason: c.reason,
      priority: c.priority,
      category: c.category || original.category,
    });
  }

  // 确保领域多样性
  const diverse = enforceDiversity(candidates, cfg.output.max_per_category);

  // 按优先级和分数排序
  diverse.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "top" ? -1 : 1;
    return b.finalScore - a.finalScore;
  });

  // 限制数量
  const topItems = diverse.filter(i => i.priority === "top").slice(0, cfg.output.top_count);
  const normalItems = diverse.filter(i => i.priority === "normal").slice(0, cfg.output.normal_count);

  const result = [...topItems, ...normalItems];

  console.log(`  📋 [editor] 筛选出 ${result.length} 条 (${topItems.length} top + ${normalItems.length} normal)`);

  return result;
}
