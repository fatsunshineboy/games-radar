/**
 * 发布稿生成器 - 生成适合游戏网站发布的简略版MD
 * 输出到 news.md（不commit，仅用于复制发表）
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

/** 生成发布稿 */
export async function generatePublishMd(): Promise<void> {
  const date = getBeijingDate();
  const finalPath = `data/${date}/final.json`;

  // 读取今日最终稿
  const finalData = readFile(finalPath);
  if (!finalData) {
    console.log("⚠️  [publish] 未找到今日稿件，跳过");
    return;
  }

  let items: FinalItem[];
  try {
    items = JSON.parse(finalData);
  } catch {
    console.log("⚠️  [publish] 解析稿件失败，跳过");
    return;
  }

  if (items.length === 0) {
    console.log("⚠️  [publish] 今日稿件为空，跳过");
    return;
  }

  console.log(`\n📝 [publish] 生成发布稿 (${items.length} 条)...`);

  // 构建输入数据
  const itemsInput = items.map((item, i) => ({
    rank: i + 1,
    title: item.chineseTitle,
    article: item.article,
    emoji: getEmoji(item.category),
    link: item.link,
    source: item.sourceName,
  }));

  const cfg = loadConfig();

  const systemPrompt = `你是一位专业的游戏新闻编辑，擅长撰写简洁、吸引人的新闻稿件。
你的任务是将今日游戏资讯整理成适合在游戏社区/网站发布的格式。

要求：
1. 保持新闻的核心信息，但简化表达
2. 标题要吸引眼球，可以使用emoji点缀
3. 每条新闻控制在100-150字
4. 格式整齐，方便直接复制发表
5. 保留原文链接（每条新闻末尾加"详情：[链接]"）

输出格式：
## 📰 今日游戏速报 (${date})

[新闻内容，每条一行]

---
共X条资讯 | 来源：游戏速报`;

  const userPrompt = `请整理以下${items.length}条今日游戏资讯，生成适合发布的简略版稿件：

${JSON.stringify(itemsInput, null, 2)}

请直接输出Markdown内容，不要有任何解释。`;

  // 调用LLM生成发布稿
  const publishMd = await callLlm(systemPrompt, userPrompt);

  // 写入根目录 news.md
  const publishPath = path.join(PROJECT_ROOT, "news.md");
  fs.writeFileSync(publishPath, publishMd, "utf-8");

  console.log(`✅ [publish] 发布稿已生成：news.md`);
  console.log(`   → 可直接复制发表到游戏网站/社区`);
}

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePublishMd().catch(console.error);
}