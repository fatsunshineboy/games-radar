/**
 * 写手智能体 - 翻译标题、撰写摘要、提取标签
 */

import { callLlm, parseJson } from "../utils/util_llm.ts";
import { loadPrompts } from "../utils/util_config.ts";
import type { CandidateItem, DraftedItem } from "../type/types.ts";

interface WriterOutput {
  chineseTitle: string;
  analysis: {
    fact: string;
    importance: string;
    trend: string;
  };
  tags: string[];
  category: string;
}

/** 运行写手智能体（逐条处理） */
export async function runWriter(items: CandidateItem[]): Promise<DraftedItem[]> {
  const prompts = loadPrompts();
  const results: DraftedItem[] = [];

  for (const item of items) {
    const userPrompt = prompts.writer.user
      .replace("{{title}}", item.title)
      .replace("{{source}}", item.sourceName)
      .replace("{{link}}", item.link)
      .replace("{{description}}", item.description)
      .replace("{{content}}", item.content.slice(0, 5000))
      .replace("{{score}}", String(item.finalScore))
      .replace("{{reason}}", item.reason);

    try {
      const response = await callLlm(prompts.writer.system, userPrompt);
      const output = parseJson<WriterOutput>(response);

      results.push({
        ...item,
        chineseTitle: output.chineseTitle,
        analysis: output.analysis,
        tags: output.tags,
        category: output.category || item.category,
      });

      console.log(`  ✍️  [writer] ${item.id}: "${output.chineseTitle}"`);
    } catch (err) {
      console.error(`  ❌ [writer] ${item.id}: 错误 - ${err}`);
      // 失败时保留，使用原标题
      results.push({
        ...item,
        chineseTitle: item.title,
        analysis: { fact: "（生成失败）", importance: "", trend: "" },
        tags: [],
      });
    }
  }

  return results;
}
