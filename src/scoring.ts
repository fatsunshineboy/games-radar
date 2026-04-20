/**
 * 评分系统 - 计算最终分数
 *
 * 最终分数 = 基础分 + 来源权威加成 + 多源交叉加成 + 时效性加成 - 重复惩罚
 */

import { loadConfig } from "./utils/util_config.ts";
import { hoursAgo } from "./utils/util_timezone.ts";
import type { CandidateItem, NewsItem, ScoreBreakdown, HistorySummary } from "./type/types.ts";
import { titleSimilarity } from "./rss.ts";

/** 计算来源权威加成 */
export function calcTierBonus(tier: number): number {
  const cfg = loadConfig();
  const bonusMap = cfg.scoring.source_tier_bonus;
  const key = `tier${tier}`;
  return (bonusMap[key] as number) ?? 0;
}

/** 计算多源交叉加成: (sourceCount - 1) × bonus, 封顶 max */
export function calcCrossBonus(sourceCount: number): number {
  const cfg = loadConfig();
  const bonus = (sourceCount - 1) * cfg.scoring.cross_source_bonus;
  return Math.min(bonus, cfg.scoring.max_cross_bonus);
}

/** 计算时效性加成 */
export function calcFreshnessBonus(timestamp: string): number {
  const cfg = loadConfig();
  const hours = hoursAgo(timestamp);

  if (hours < 24) return cfg.scoring.freshness.within_24h;
  if (hours < 48) return cfg.scoring.freshness.within_48h;
  if (hours < 72) return cfg.scoring.freshness.within_72h;
  return cfg.scoring.freshness.over_72h;
}

/** 计算历史重复惩罚 */
export function calcHistoryPenalty(title: string, history: HistorySummary[]): number {
  const cfg = loadConfig();

  for (const day of history) {
    for (const histTitle of day.titles) {
      const sim = titleSimilarity(title, histTitle);
      if (sim > 0.7) return cfg.scoring.history_penalty.similarity_high;
      if (sim > 0.6) return cfg.scoring.history_penalty.similarity_medium;
    }
  }

  return 0;
}

/** 计算完整的最终分数 */
export function calcFinalScore(
  baseScore: number,
  scoreBreakdown: ScoreBreakdown,
  item: NewsItem,
  history: HistorySummary[]
): {
  tierBonus: number;
  crossBonus: number;
  freshnessBonus: number;
  historyPenalty: number;
  breakdownTotal: number;
  finalScore: number;
} {
  const tierBonus = calcTierBonus(item.tier);
  const crossBonus = calcCrossBonus(item.sourceCount);
  const freshnessBonus = calcFreshnessBonus(item.timestamp);
  const historyPenalty = calcHistoryPenalty(item.title, history);

  // breakdown 各项求和参与最终分数
  const breakdownTotal =
    scoreBreakdown.influence +
    scoreBreakdown.audience +
    scoreBreakdown.scarcity +
    scoreBreakdown.followup +
    scoreBreakdown.actionable;

  const finalScore = Math.max(0,breakdownTotal + tierBonus + crossBonus + freshnessBonus + historyPenalty);

  return { tierBonus, crossBonus, freshnessBonus, historyPenalty, breakdownTotal, finalScore };
}

/** 确保领域多样性：每个 category 最多 maxPerCategory 条 */
export function enforceDiversity(items: CandidateItem[], maxPerCategory: number): CandidateItem[] {
  const categoryCount: Record<string, number> = {};
  const result: CandidateItem[] = [];

  // 按 finalScore 降序排列
  const sorted = [...items].sort((a, b) => b.finalScore - a.finalScore);

  for (const item of sorted) {
    const cat = item.category;
    const current = categoryCount[cat] || 0;
    if (current < maxPerCategory) {
      result.push(item);
      categoryCount[cat] = current + 1;
    }
  }

  return result;
}
