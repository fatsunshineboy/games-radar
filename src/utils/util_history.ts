/**
 * 历史回顾 - 读取前N天的报道，用于去重和重复检测
 */

import { readFile } from "./util_file.ts";
import { getPastDates } from "./util_timezone.ts";
import type { HistorySummary } from "../type/types.ts";

/** 从 digest markdown 中解析 item JSON 数据 */
function parseDigestItems(content: string): { title: string; chineseTitle: string; article: string }[] {
  const items: { title: string; chineseTitle: string; article: string }[] = [];
  const startMarker = "<!-- item: ";
  const endMarker = " -->";

  let pos = 0;
  while (pos < content.length) {
    const startIdx = content.indexOf(startMarker, pos);
    if (startIdx === -1) break;

    const jsonStart = startIdx + startMarker.length;
    const endIdx = content.indexOf(endMarker, jsonStart);
    if (endIdx === -1) break;

    const jsonStr = content.slice(jsonStart, endIdx);
    try {
      const itemData = JSON.parse(jsonStr);
      items.push({
        title: itemData.originalTitle || "",
        chineseTitle: itemData.chineseTitle || "",
        article: itemData.article || ""
      });
    } catch {
      // JSON 解析失败时跳过
    }

    pos = endIdx + endMarker.length;
  }

  return items;
}

/** 加载前N天的历史摘要 */
export function loadHistory(lookbackDays: number): HistorySummary[] {
  const dates = getPastDates(lookbackDays);
  const history: HistorySummary[] = [];

  for (const date of dates) {
    const content = readFile(`digests/${date}.md`);
    if (content) {
      const items = parseDigestItems(content);
      if (items.length > 0) {
        history.push({
          date,
          titles: items.map(item => item.title),
          chineseTitles: items.map(item => item.chineseTitle),
          articles: items.map(item => item.article)
        });
      }
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