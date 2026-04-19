/**
 * 审核智能体 - 质量审核、标题党检测、事实核查
 */

import { callLlm, parseJson } from "../utils/util_llm.ts";
import { loadPrompts } from "../utils/util_config.ts";
import { formatHistoryForPrompt } from "../utils/util_history.ts";
import type { DraftedItem, FinalItem, HistorySummary, ReviewResult } from "../type/types.ts";

interface ReviewerOutput {
  decision: "pass" | "revise" | "reject";
  reason: string;
  suggestions: string;
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
): Promise<ReviewResult> {
  const prompts = loadPrompts();
  const passed: FinalItem[] = [];
  const toRevise: DraftedItem[] = [];
  const rejected: FinalItem[] = [];

  // 第一轮：程序级检查（标题党关键词）
  const toLlmReview: DraftedItem[] = [];
  for (const item of items) {
    const hasClickbait = CLICKBAIT_WORDS.some(w => item.chineseTitle.includes(w));
    if (hasClickbait) {
      rejected.push({
        ...item,
        reviewDecision: "reject",
        reviewReason: "标题党关键词",
        reviewSuggestions: "请修改标题，避免使用夸张的词语",
      });
      console.log(`  🚫 [reviewer] ${item.id}: 程序拒绝 (标题党关键词)`);
    } else {
      toLlmReview.push(item);
    }
  }

  if (toLlmReview.length === 0) {
    return { passed, toRevise, rejected };
  }

  // 第二轮：LLM 审核
  const historyText = formatHistoryForPrompt(history);

  for (const item of toLlmReview) {
    let userPrompt = prompts.reviewer.user
      .replace("{{chineseTitle}}", item.chineseTitle)
      .replace("{{originalTitle}}", item.title)
      .replace("{{source}}", item.sourceName)
      .replace("{{article}}", item.article)
      .replace("{{originalContent}}", item.content)
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
        passed.push({
          ...item,
          reviewDecision: "pass",
          reviewReason: output.reason || "审核通过",
          reviewSuggestions: output.suggestions || "",
        });
        console.log(`  ✅ [reviewer] ${item.id}: 通过`);
      } else if (output.decision === "revise") {
        toRevise.push({
          ...item,
          reviewSuggestions: output.suggestions,
        });
        console.log(`  📝 [reviewer] ${item.id}: 需修订 - ${output.reason}`);
      } else {
        rejected.push({
          ...item,
          reviewDecision: "reject",
          reviewReason: output.reason,
          reviewSuggestions: output.suggestions || "",
        });
        console.log(`  🚫 [reviewer] ${item.id}: 拒绝 - ${output.reason}`);
      }
    } catch (err) {
      // LLM 错误时默认拒绝
      rejected.push({
        ...item,
        reviewDecision: "reject",
        reviewReason: `LLM错误: ${err}`,
        reviewSuggestions: "",
      });
      console.error(`  ⚠️  [reviewer] ${item.id}: LLM错误，拒绝 - ${err}`);
    }
  }

  return { passed, toRevise, rejected };
}
