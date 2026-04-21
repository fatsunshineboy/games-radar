/**
 * Banner 图片生成器 - 生成今日资讯总结图片
 * 保存到 images/banner-{date}.png（commit到仓库）
 * 前端通过 GitHub raw URL 动态引用
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

/** 调用 LLM 生成图片提示词中的文字内容 */
async function generateImageText(items: FinalItem[], date: string, siteName: string): Promise<string> {
  const top5 = items.slice(0, 5);

  const itemsInfo = top5.map((item, i) => ({
    rank: i + 1,
    emoji: getEmoji(item.category),
    title: item.chineseTitle,
    summary: item.article.slice(0, 100),
  }));

  const systemPrompt = `你是一位专业的游戏新闻视觉设计师。
你的任务是根据今日资讯内容，为一张资讯总结Banner图片生成应该显示的文字内容。

要求：
1. 图片是横版比例（1200x630），适合网页展示
2. 内容应该精炼、吸引眼球
3. 需要包含：标题区域、日期、站点名、3-5条新闻标题
4. 每条新闻标题不超过15字，简洁有力
5. 输出JSON格式的图片文字布局`;

  const userPrompt = `今日资讯如下：
${JSON.stringify(itemsInfo, null, 2)}

日期：${date}
站点名：${siteName}

请生成图片中应该显示的文字内容，输出JSON：
{
  "title": "今日游戏速报",
  "date": "2026年4月21日",
  "brand": "游戏速报",
  "news": [
    {"num": "01", "emoji": "🎮", "title": "简短标题"},
    {"num": "02", "emoji": "💼", "title": "简短标题"},
    {"num": "03", "emoji": "🎮", "title": "简短标题"}
  ],
  "watermark": "游戏速报"
}

只输出JSON，不要解释。`;

  const response = await callLlm(systemPrompt, userPrompt);

  // 解析JSON
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
  } catch {}

  // 回退：直接生成简单结构
  return JSON.stringify({
    title: "今日游戏速报",
    date: date.replace(/-/g, "年").replace(/-/, "月") + "日",
    brand: siteName,
    news: top5.slice(0, 3).map((item, i) => ({
      num: `0${i + 1}`,
      emoji: getEmoji(item.category),
      title: item.chineseTitle.slice(0, 15),
    })),
    watermark: "游戏速报",
  });
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
          size: "1200x630", // 横版比例
          n: 1,
          quality: "high",
          moderation: "low",
          background: "auto",
        },
      }),
    });

    if (!res.ok) {
      console.error(`❌ [banner] API 错误: ${res.status}`);
      return false;
    }

    const data = await res.json();

    // 获取图片数据（可能是URL或base64）
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

  // 1. 调用LLM生成图片文字内容
  console.log(`  📝 [banner] 生成图片文字内容...`);
  const imageTextJson = await generateImageText(items, date, siteName);
  const imageText = JSON.parse(imageTextJson);

  // 2. 构建图片提示词
  const newsText = imageText.news.map((n: { num: string; emoji: string; title: string }) =>
    `${n.num}. ${n.emoji} ${n.title}`
  ).join("\n");

  const prompt = `
Create a horizontal infographic (16:9 ratio) with hand-drawn illustration style.

CONTENT TO DISPLAY:
- Header: "${imageText.title}" with date "${imageText.date}"
- Brand: "${imageText.brand}"
- News highlights (3 blocks):
${newsText}
- Watermark: "${imageText.watermark}" in bottom right

STYLE REQUIREMENTS:
- Hand-drawn infographic, sketch style, notebook aesthetic (Notion-style handbook)
- Warm cream/beige background with low saturation colors (soft orange, green, blue accents)
- Black hand-drawn outlines with slight roughness
- Modular card layout with rounded corners, cloud-like borders, sticky note style
- Each news item with simple illustration icon
- Cute but professional, clear and readable
- Chinese text must be CLEARLY LEGIBLE
- Horizontal banner format (1200x630, 16:9 ratio)
- Suitable for PPT presentation and social media sharing

KEYWORDS: hand-drawn infographic, sketch style, soft pastel color, educational illustration, notebook style, warm, clean layout, cute but professional
`;

  // 3. 创建 images 目录
  const imagesDir = path.join(PROJECT_ROOT, "images");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // 4. 生成图片（按日期命名）
  const bannerPath = path.join(imagesDir, `banner-${date}.png`);
  const success = await generateImage(prompt, bannerPath);

  return success ? bannerPath : null;
}

/** 获取 GitHub raw URL */
export function getBannerUrl(date: string): string {
  // GitHub raw URL 格式
  return `https://raw.githubusercontent.com/fatsunshineboy/games-radar/main/images/banner-${date}.png`;
}

// 直接运行
generateBanner().catch(console.error);