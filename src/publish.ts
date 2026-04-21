/**
 * 发布稿生成器 - 生成适合游戏网站发布的简略版MD
 * 保存到 news/news-{date}.md（commit到仓库）
 */

import { readFile } from "./utils/util_file.ts";
import { callLlm } from "./utils/util_llm.ts";
import { loadConfig } from "./utils/util_config.ts";
import { getBeijingDate } from "./utils/util_timezone.ts";
import { getEmoji } from "./web/parser.ts";
import type { FinalItem } from "./type/types.ts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/** 获取 GitHub raw URL */
export function getPublishUrl(date: string): string {
  return `https://raw.githubusercontent.com/fatsunshineboy/games-radar/main/news/news-${date}.md`;
}

/** 生成发布稿 */
export async function generatePublishMd(): Promise<string | null> {
  const date = getBeijingDate();
  const finalPath = `data/${date}/final.json`;

  const finalData = readFile(finalPath);
  if (!finalData) {
    console.log("⚠️  [publish] 未找到今日稿件，跳过");
    return null;
  }

  let items: FinalItem[];
  try {
    items = JSON.parse(finalData);
  } catch {
    console.log("⚠️  [publish] 解析稿件失败，跳过");
    return null;
  }

  if (items.length === 0) {
    console.log("⚠️  [publish] 今日稿件为空，跳过");
    return null;
  }

  console.log(`\n📝 [publish] 生成发布稿 (${items.length} 条)...`);

  const itemsInput = items.map((item, i) => ({
    rank: i + 1,
    title: item.chineseTitle,
    article: item.article,
    emoji: getEmoji(item.category),
    link: item.link,
    source: item.sourceName,
  }));

  const cfg = loadConfig();
  const siteName = cfg.site.name_zh || "游戏速报";

  const [y, m, d] = date.split("-");
  const dateText = `${y}年${m}月${d}日`;

  const systemPrompt = `你是一位专业的游戏新闻编辑，擅长撰写简洁、吸引人的新闻稿件。
你的任务是将今日游戏资讯整理成适合在游戏社区/网站发布的格式。

要求：
1. 保持新闻的核心信息，但简化表达
2. 标题要吸引眼球，可以使用emoji点缀
3. 每条新闻控制在100-150字
4. 格式整齐，方便直接复制发表
5. 保留原文链接（每条新闻末尾加"详情：[链接]"）

输出格式：
## 📰 今日游戏速报 (${dateText})

[新闻内容]

---
共X条资讯 | 来源：${siteName}`;

  const userPrompt = `请整理以下${items.length}条今日游戏资讯，生成适合发布的简略版稿件：

${JSON.stringify(itemsInput, null, 2)}

请直接输出Markdown内容，不要有任何解释。`;

  const publishMd = await callLlm(systemPrompt, userPrompt);

  // 创建 news 目录
  const newsDir = path.join(PROJECT_ROOT, "news");
  if (!fs.existsSync(newsDir)) {
    fs.mkdirSync(newsDir, { recursive: true });
  }

  // 按日期命名保存
  const publishPath = path.join(newsDir, `news-${date}.md`);
  fs.writeFileSync(publishPath, publishMd, "utf-8");

  console.log(`✅ [publish] 发布稿已保存：news/news-${date}.md`);
  return publishPath;
}

// 直接运行
generatePublishMd().catch(console.error);