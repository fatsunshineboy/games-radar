/**
 * 写手智能体 - 翻译标题、撰写摘要、提取标签
 */

import { callLlm, parseJson } from "../utils/util_llm.ts";
import { loadPrompts } from "../utils/util_config.ts";
import type { CandidateItem, DraftedItem } from "../type/types.ts";

interface WriterOutput {
  chineseTitle: string;
  article: string;
  tags: string[];
  category: string;
}

/** 运行写手智能体（首次写作 + 修订复用） */
export async function runWriter(
  items: CandidateItem[] | DraftedItem[]
): Promise<DraftedItem[]> {
  const prompts = loadPrompts();
  const results: DraftedItem[] = [];

  for (const item of items) {
    // 构建基础 prompt
    let userPrompt = prompts.writer.user
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
      const response = await callLlm(prompts.writer.system, userPrompt);
      const output = parseJson<WriterOutput>(response);

      // 计算修订次数：首次写作为 0，修订时累加
      const newRevisionCount = isRevision
        ? (item as DraftedItem).revisionCount + 1
        : 0;

      results.push({
        ...item,
        chineseTitle: output.chineseTitle,
        article: output.article,
        tags: output.tags,
        category: output.category || item.category,
        revisionCount: newRevisionCount,
        reviewSuggestions: undefined,
      });

      console.log(`  ✍️  [writer] ${item.id}: "${output.chineseTitle}" ${isRevision ? "(修订)" : ""}`);
    } catch (err) {
      console.error(`  ❌ [writer] ${item.id}: 错误 - ${err}`);
    }
  }

  return results;
}
