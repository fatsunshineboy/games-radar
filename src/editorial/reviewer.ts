/**
 * 审核智能体 - 质量审核、标题党检测、事实核查
 */

import { callLlm, parseJson } from "../utils/util_llm.ts";
import { loadConfig, loadPrompts } from "../utils/util_config.ts";
import { formatHistoryForPrompt } from "../utils/util_history.ts";
import { parallelWithRetry } from "../utils/util_concurrency.ts";
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

/** 审核单条资讯 */
async function reviewItem(
  item: DraftedItem,
  prompts: { system: string; user: string },
  historyText: string
): Promise<{ passed: FinalItem | null; toRevise: DraftedItem | null; rejected: FinalItem | null }> {
  // 程序级检查（标题党关键词）
  const hasClickbait = CLICKBAIT_WORDS.some(w => item.chineseTitle.includes(w));
  if (hasClickbait) {
    return {
      passed: null,
      toRevise: {
        ...item,
        reviewSuggestions: `修订原因:标题党关键词\n修订建议:请修改标题，避免使用夸张的词语\n上一轮文章:${item.article}\n`,
      },
      rejected: null,
    };
  }

  // LLM 审核
  let userPrompt = prompts.user
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
    const response = await callLlm(prompts.system, userPrompt);
    const output = parseJson<ReviewerOutput>(response);

    if (output.decision === "pass") {
      return {
        passed: {
          ...item,
          reviewDecision: "pass",
          reviewReason: output.reason || "审核通过",
          reviewSuggestions: output.suggestions || "",
        },
        toRevise: null,
        rejected: null,
      };
    } else if (output.decision === "revise") {
      return {
        passed: null,
        toRevise: {
          ...item,
          reviewSuggestions: `修订原因:${output.reason}\n修订建议:${output.suggestions}\n上一轮文章:${item.article}\n`,
        },
        rejected: null,
      };
    } else {
      return {
        passed: null,
        toRevise: {
          ...item,
          reviewSuggestions: `修订原因:${output.reason}\n修订建议:${output.suggestions}\n上一轮文章:${item.article}\n`,
        },
        rejected: null,
        // rejected: {
        //   ...item,
        //   reviewDecision: "reject",
        //   reviewReason: output.reason,
        //   reviewSuggestions: output.suggestions || "",
        // },
      };
    }
  } catch (err) {
    return {
      passed: null,
      toRevise: null,
      rejected: {
        ...item,
        reviewDecision: "reject",
        reviewReason: `LLM错误: ${err}`,
        reviewSuggestions: "",
      },
    };
  }
}

/** 运行审核智能体 */
export async function runReviewer(
  items: DraftedItem[],
  history: HistorySummary[]
): Promise<ReviewResult> {
  const prompts = loadPrompts();
  const cfg = loadConfig();
  const concurrency = cfg.concurrency.reviewer;
  const historyText = formatHistoryForPrompt(history);

  console.log(`  🔎 [reviewer] 审核 ${items.length} 条（并行 ${concurrency}）...`);

  const results = await parallelWithRetry(
    items,
    concurrency,
    (item) => reviewItem(item, prompts.reviewer, historyText)
  );

  // 分类结果
  const passed: FinalItem[] = [];
  const toRevise: DraftedItem[] = [];
  const rejected: FinalItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const r = results[i];
    if (r.passed) {
      passed.push(r.passed);
      console.log(`  ✅ [reviewer] ${items[i].id}: 通过`);
    } else if (r.toRevise) {
      toRevise.push(r.toRevise);
      const reason = CLICKBAIT_WORDS.some(w => items[i].chineseTitle.includes(w))
        ? "标题党关键词"
        : (r.toRevise.reviewSuggestions?.split("\n")[0]?.replace("$修订原因:", "") || "需修订");
      console.log(`  📝 [reviewer] ${items[i].id}: 需修订 - ${reason}`);
    } else if (r.rejected) {
      rejected.push(r.rejected);
      console.log(`  🚫 [reviewer] ${items[i].id}: 拒绝 - ${r.rejected.reviewReason}`);
    }
  }

  console.log(`  📊 [reviewer] 完成：通过 ${passed.length}, 待修订 ${toRevise.length}, 拒绝 ${rejected.length}`);

  return { passed, toRevise, rejected };
}
