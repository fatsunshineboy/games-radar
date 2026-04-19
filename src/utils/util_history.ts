/**
 * 历史回顾 - 读取前N天的报道，用于去重和重复检测
 */

import { readJson } from "./util_file.ts";
import { getPastDates } from "./util_timezone.ts";
import type { FinalItem, HistorySummary } from "../type/types.ts";

/** 加载前N天的历史摘要 */
export function loadHistory(lookbackDays: number): HistorySummary[] {
  const dates = getPastDates(lookbackDays);
  const history: HistorySummary[] = [];

  for (const date of dates) {
    const data = readJson<FinalItem[]>(`data/${date}/final.json`);
    if (data && Array.isArray(data)) {
      history.push({
        date,
        titles: data.map(item => item.title),
        chineseTitles: data.map(item => item.chineseTitle || ""),
        articles: data.map(item => item.article || "")
      });
    }
  }

  return history;
}

/** 将历史摘要格式化为文本（供 prompt 使用） */
export function formatHistoryForPrompt(history: HistorySummary[]): string {
  if (history.length === 0) return "";

  let text = "";
  for (const day of history) {
    text += `### ${day.date}\n`;
    for (let i = 0; i < day.titles.length; i++) {
      const cn = day.chineseTitles[i];
      const article = day.articles[i];
      text += `→ en_title: ${day.titles[i]}`;
      if (cn) text += ` → cn_title: ${cn}`;
      if (article) text += `\n  article: ${article}`;
      text += "\n";
    }
    text += "\n";
  }

  return text;
}
