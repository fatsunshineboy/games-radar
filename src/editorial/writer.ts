/**
 * 写手智能体 - 翻译标题、撰写摘要、提取标签
 */

import { callLlm, parseJson } from "../utils/util_llm.ts";
import { loadConfig, loadPrompts } from "../utils/util_config.ts";
import { parallelWithRetry } from "../utils/util_concurrency.ts";
import { titleSimilarity } from "../utils/util_similarity.ts";
import type { CandidateItem, DraftedItem } from "../type/types.ts";

interface WriterOutput {
  chineseTitle: string;
  article: string;
  tags: string[];
  category: string;
}

/** 检查中文标题与当天已生成标题的相似度 */
function checkTodayDuplicate(
  chineseTitle: string,
  existingTitles: string[],
  threshold: number
): { isDuplicate: boolean; maxSimilarity: number; matchedTitle: string | null } {
  let maxSim = 0;
  let matchedTitle: string | null = null;

  for (const existing of existingTitles) {
    const sim = titleSimilarity(chineseTitle, existing);
    if (sim > maxSim) {
      maxSim = sim;
      matchedTitle = existing;
    }
  }

  return {
    isDuplicate: maxSim >= threshold,
    maxSimilarity: maxSim,
    matchedTitle,
  };
}

/** 处理单条资讯 */
async function writeItem(
  item: CandidateItem | DraftedItem,
  prompts: { system: string; user: string }
): Promise<DraftedItem | null> {
  // 构建基础 prompt
  let userPrompt = prompts.user
    .replace("{{title}}", item.title)
    .replace("{{source}}", item.sourceName)
    .replace("{{link}}", item.link)
    .replace("{{description}}", item.description)
    .replace("{{content}}", item.content.slice(0, 10000))
    .replace("{{score}}", String(item.finalScore))
    .replace("{{reason}}", item.reason);

  // 如果是修订（DraftedItem 且有 suggestions），添加修改建议
  const isRevision = "chineseTitle" in item && item.reviewSuggestions;
  if (isRevision) {
    userPrompt += `\n\n【审核建议】\n${item.reviewSuggestions}\n请根据以上建议重新撰写。`;
  }

  try {
    const response = await callLlm(prompts.system, userPrompt);
    const output = parseJson<WriterOutput>(response);

    // 计算修订次数：首次写作为 0，修订时累加
    const newRevisionCount = isRevision
      ? (item as DraftedItem).revisionCount + 1
      : 0;

    const result = {
      ...item,
      chineseTitle: output.chineseTitle,
      article: output.article,
      tags: output.tags,
      category: output.category || item.category,
      revisionCount: newRevisionCount,
      reviewSuggestions: undefined,
    };

    console.log(`  ✍️  [writer] ${item.id}: "${output.chineseTitle}" ${isRevision ? "(修订)" : ""}`);
    return result;
  } catch (err) {
    console.error(`  ❌ [writer] ${item.id}: 错误 - ${err}`);
    return null;
  }
}

/** 运行写手智能体（首次写作 + 修订复用） */
export async function runWriter(
  items: CandidateItem[] | DraftedItem[]
): Promise<DraftedItem[]> {
  const prompts = loadPrompts();
  const cfg = loadConfig();
  const concurrency = cfg.concurrency.writer;
  const threshold = cfg.deduplication.similarity_threshold;

  console.log(`  ✍️  [writer] 处理 ${items.length} 条（并行 ${concurrency}）...`);

  const results = await parallelWithRetry(
    items,
    concurrency,
    (item, index) => writeItem(item, prompts.writer)
  );

  // 过滤掉失败的
  const successful = results.filter((r): r is DraftedItem => r !== null);

  // 检查当天已生成标题的相似度（顺序检查，保留先生成的）
  const passed: DraftedItem[] = [];
  const todayTitles: string[] = [];

  for (const item of successful) {
    const dupCheck = checkTodayDuplicate(item.chineseTitle, todayTitles, threshold);
    if (dupCheck.isDuplicate) {
      console.log(`  ⏭️  [writer] ${item.id}: "${item.chineseTitle}" 与当天"${dupCheck.matchedTitle}"相似度 ${dupCheck.maxSimilarity.toFixed(2)} >= ${threshold}，丢弃`);
      continue;
    }
    passed.push(item);
    todayTitles.push(item.chineseTitle);  // 添加到当天已生成列表
  }

  console.log(`  ✍️  [writer] 完成 ${passed.length}/${items.length} 条（已过滤 ${successful.length - passed.length} 条当天重复）`);
  return passed;
}
