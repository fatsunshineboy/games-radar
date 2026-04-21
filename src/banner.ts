/**
 * Banner 图片生成器 - 生成今日资讯总结图片
 * 流程：先让大模型基于模板生成详细的生图提示词，再生成图片
 * 保存到 images/banner-{date}.png（commit到仓库）
 */

import { readFile } from "./utils/util_file.ts";
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

/** 手动提示词模板（作为风格参考） */
const PROMPT_TEMPLATE = `Create a hand-drawn infographic banner for daily gaming news.

LAYOUT:
- TOP: Title "今日游戏速报" with date "YYYY年MM月DD日"
- MIDDLE: 3 news cards arranged vertically or in 2x1+1 layout
- BOTTOM: Small watermark "游戏速报"

EACH NEWS CARD SHOULD DISPLAY:
- Number badge (01, 02, 03)
- Emoji icon matching the topic
- Chinese title (clearly visible, bold)
- Brief summary content (about 30-50 Chinese characters, smaller text)
- Small decorative illustration matching the news topic

VISUAL STYLE:
- Hand-drawn sketch, notebook/journal aesthetic
- Warm cream/beige background (#F5F0E6 or similar)
- Low saturation colors (soft orange, mint green, sky blue)
- Black hand-drawn outlines with slight roughness
- Rounded cards/bubbles with cloud-like borders
- Decorative elements: stars, dots, arrows, underlines
- Each card has enough space for title + content
- Playful but professional, easy to read

TEXT REQUIREMENTS:
- All Chinese text must be CLEARLY LEGIBLE
- Title prominently at top
- Each news card: number + emoji + title + brief summary
- Summary text smaller but readable

SIZE: 1536x1024 (3:2 horizontal)

KEYWORDS: hand-drawn infographic, notebook style, pastel colors, educational illustration, cute professional, Chinese text readable`;

/** 调用大模型生成详细的生图提示词 */
async function generateImagePrompt(items: FinalItem[], date: string, siteName: string): Promise<string> {
  const apiKey = process.env.AIHUBMIX_API_KEY;
  if (!apiKey) {
    throw new Error("未设置 AIHUBMIX_API_KEY");
  }

  const baseUrl = process.env.AIHUBMIX_BASE_URL || "https://aihubmix.com";
  const top3 = items.slice(0, 3);
  const [y, m, d] = date.split("-");
  const dateText = `${y}年${m}月${d}日`;

  // 准备新闻内容
  const newsContent = top3.map((item, i) => {
    const emoji = getEmoji(item.category);
    const title = item.chineseTitle;
    const summary = item.article.slice(0, 100).replace(/\n/g, ' ').replace(/\s+/g, ' ');
    return `新闻${i + 1}:\n标题: ${emoji} ${title}\n概要: ${summary}`;
  }).join("\n\n");

  const systemPrompt = `你是一位专业的AI绘图提示词专家。

你的任务是：根据提供的新闻内容，生成一个详细的AI绘图提示词。

你必须参考以下模板来生成提示词，确保风格统一：

=== 提示词模板 ===
${PROMPT_TEMPLATE}
=== 模板结束 ===

要求：
1. 保持模板中的视觉风格（手绘、暖色调、可爱专业）
2. 将模板中的占位符替换为实际的新闻内容
3. 明确写出每条新闻的标题和概要文字应该出现在图片的哪个位置
4. 文字内容直接用中文写在提示词中
5. 输出的提示词格式与模板类似，但包含具体内容`;

  const userPrompt = `请根据以下新闻内容生成绘图提示词（参考模板风格）：

日期: ${dateText}
站点名: ${siteName}

新闻内容:
${newsContent}

请输出完整的英文绘图提示词，风格与模板一致，但包含具体新闻内容。直接输出提示词，不要解释。`;

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API 错误: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** 调用 Aihubmix 绘图 API */
async function generateImage(prompt: string, outputPath: string): Promise<boolean> {
  const apiKey = process.env.AIHUBMIX_API_KEY;
  if (!apiKey) {
    console.log("⚠️  [banner] 未设置 AIHUBMIX_API_KEY，跳过图片生成");
    return false;
  }

  const baseUrl = process.env.AIHUBMIX_BASE_URL || "https://aihubmix.com";

  try {
    const res = await fetch(`${baseUrl}/v1/models/openai/gpt-image-1.5/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          prompt,
          size: "1536x1024",
          n: 1,
          quality: "high",
          moderation: "low",
          background: "auto",
        },
      }),
    });

    if (!res.ok) {
      console.error(`❌ [banner] 绘图API 错误: ${res.status}`);
      return false;
    }

    const data = await res.json();

    let imgBuffer: Buffer;

    if (data.output?.b64_json) {
      const b64Data = Array.isArray(data.output.b64_json)
        ? data.output.b64_json[0]?.bytesBase64 || data.output.b64_json[0]
        : data.output.b64_json;
      imgBuffer = Buffer.from(b64Data, "base64");
    } else if (data.output?.[0]?.b64_json) {
      imgBuffer = Buffer.from(data.output[0].b64_json, "base64");
    } else {
      const imageUrl = data.output?.[0]?.url || data.data?.[0]?.url || data.url || data.image_url;
      if (!imageUrl) {
        console.error(`❌ [banner] 未返回图片数据`);
        return false;
      }
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        console.error(`❌ [banner] 图片下载失败: ${imgRes.status}`);
        return false;
      }
      imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    }

    fs.writeFileSync(outputPath, imgBuffer);
    console.log(`✅ [banner] 图片已保存：${outputPath}`);
    return true;
  } catch (err) {
    console.error(`❌ [banner] 生成失败: ${err}`);
    return false;
  }
}

/** 生成 Banner 图片 */
export async function generateBanner(): Promise<string | null> {
  const date = getBeijingDate();
  const finalPath = `data/${date}/final.json`;

  const finalData = readFile(finalPath);
  if (!finalData) {
    console.log("⚠️  [banner] 未找到今日稿件，跳过");
    return null;
  }

  let items: FinalItem[];
  try {
    items = JSON.parse(finalData);
  } catch {
    console.log("⚠️  [banner] 解析稿件失败，跳过");
    return null;
  }

  if (items.length === 0) {
    console.log("⚠️  [banner] 今日稿件为空，跳过");
    return null;
  }

  console.log(`\n🎨 [banner] 生成资讯总结图片...`);

  const cfg = loadConfig();
  const siteName = cfg.site.name_zh || "游戏速报";

  // 1. 先调用大模型生成详细的生图提示词（参考模板）
  console.log(`  📝 [banner] 大模型生成绘图提示词（参考模板风格）...`);
  let prompt: string;
  try {
    prompt = await generateImagePrompt(items, date, siteName);
    console.log(`  ✅ [banner] 提示词已生成`);

    // 打印生成的提示词
    console.log("\n" + "=".repeat(60));
    console.log("📝 [生图提示词]");
    console.log("=".repeat(60));
    console.log(prompt);
    console.log("=".repeat(60) + "\n");
  } catch (err) {
    console.error(`❌ [banner] 生成提示词失败: ${err}`);
    return null;
  }

  // 创建 images 目录
  const imagesDir = path.join(PROJECT_ROOT, "images");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // 2. 用提示词生成图片
  console.log(`  🖼️  [banner] 生成图片...`);
  const bannerPath = path.join(imagesDir, `banner-${date}.png`);
  const success = await generateImage(prompt, bannerPath);

  return success ? bannerPath : null;
}

/** 获取 GitHub raw URL */
export function getBannerUrl(date: string): string {
  return `https://raw.githubusercontent.com/fatsunshineboy/games-radar/main/images/banner-${date}.png`;
}

// 直接运行
generateBanner().catch(console.error);