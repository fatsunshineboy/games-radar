/**
 * 审核智能体 - 质量审核、标题党检测、事实核查
 */

import { callLlm, parseJson, loadPrompts } from "../llm.ts";
import { formatHistoryForPrompt } from "../history.ts";
import type { DraftedItem, FinalItem, HistorySummary } from "../types.ts";

interface ReviewerOutput {
  decision: "pass" | "revise" | "reject";
  reason: string;
  suggestions?: {
    title?: string;
    fact?: string;
  };
  flags: string[];
}

// 程序级标题党关键词
const CLICKBAIT_WORDS = [
  "炸裂", "震撼", "杀疯了", "全网刷屏", "重磅", "惊天",
  "史诗级", "核弹级", "暴雷", "疯了", "爆了", "碾压",
];

/** 运行审核智能体 */
export async function runReviewer(
  items: DraftedItem[],
  history: HistorySummary[]
): Promise<FinalItem[]> {
  const prompts = loadPrompts();
  const results: FinalItem[] = [];

  // 第一轮：程序级检查
  const passedProgramCheck: DraftedItem[] = [];
  for (const item of items) {
    const hasClickbait = CLICKBAIT_WORDS.some(w => item.chineseTitle.includes(w));
    if (hasClickbait) {
      console.log(`  🚫 [reviewer] ${item.id}: 程序拒绝 (标题党关键词)`);
      results.push({
        ...item,
        reviewDecision: "reject",
        reviewReason: "标题党关键词",
      });
    } else {
      passedProgramCheck.push(item);
    }
  }

  if (passedProgramCheck.length === 0) return results.filter(r => r.reviewDecision === "pass");

  // 第二轮：LLM 审核（审核 top 优先级条目 + 采样 normal 条目）
  const topItems = passedProgramCheck.filter(i => i.priority === "top");
  const normalSample = passedProgramCheck
    .filter(i => i.priority === "normal")
    .slice(0, 3); // 采样3条 normal 审核

  const toReview = [...topItems, ...normalSample];
  const autoPassIds = new Set(
    passedProgramCheck
      .filter(i => !toReview.includes(i))
      .map(i => i.id)
  );

  // 自动通过未被 LLM 审核的条目
  for (const item of passedProgramCheck) {
    if (autoPassIds.has(item.id)) {
      results.push({
        ...item,
        reviewDecision: "pass",
        reviewReason: "自动通过",
      });
    }
  }

  // LLM 审核
  const historyText = formatHistoryForPrompt(history);

  for (const item of toReview) {
    let userPrompt = prompts.reviewer.user
      .replace("{{chineseTitle}}", item.chineseTitle)
      .replace("{{originalTitle}}", item.title)
      .replace("{{source}}", item.sourceName)
      .replace("{{fact}}", item.analysis.fact)
      .replace("{{importance}}", item.analysis.importance)
      .replace("{{trend}}", item.analysis.trend)
      .replace("{{link}}", item.link);

    // 添加历史
    if (historyText) {
      userPrompt = userPrompt.replace("{{#if history}}", "").replace("{{/if}}", "")
        .replace("{{history}}", historyText);
    } else {
      userPrompt = userPrompt.replace(/\{\{#if history\}\}[\s\S]*?\{\{\/if\}\}/g, "");
    }

    try {
      const response = await callLlm(prompts.reviewer.system, userPrompt);
      const output = parseJson<ReviewerOutput>(response);

      if (output.decision === "pass") {
        results.push({
          ...item,
          reviewDecision: "pass",
          reviewReason: output.reason || "审核通过",
        });
        console.log(`  ✅ [reviewer] ${item.id}: 通过`);
      } else if (output.decision === "revise" && output.suggestions) {
        // 应用修改建议
        const revised: FinalItem = {
          ...item,
          chineseTitle: output.suggestions.title || item.chineseTitle,
          analysis: {
            ...item.analysis,
            fact: output.suggestions.fact || item.analysis.fact,
          },
          reviewDecision: "pass", // 修改后视为通过
          reviewReason: `已修改: ${output.reason}`,
        };
        results.push(revised);
        console.log(`  ✏️  [reviewer] ${item.id}: 修改后通过 - ${output.reason}`);
      } else {
        // reject
        results.push({
          ...item,
          reviewDecision: "reject",
          reviewReason: output.reason || "审核拒绝",
        });
        console.log(`  🚫 [reviewer] ${item.id}: 拒绝 - ${output.reason}`);
      }
    } catch (err) {
      // LLM 错误时默认通过
      console.error(`  ⚠️  [reviewer] ${item.id}: LLM错误，默认通过 - ${err}`);
      results.push({
        ...item,
        reviewDecision: "pass",
        reviewReason: "LLM审核失败，默认通过",
      });
    }
  }

  // 只返回通过的
  return results.filter(r => r.reviewDecision === "pass");
}
