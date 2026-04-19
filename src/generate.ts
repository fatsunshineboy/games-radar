/**
 * 页面生成器 - 静态站点 + Markdown 日报 + RSS Feed
 * 样式参考：https://ai-digest.liziran.com/zh/
 */

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./llm.ts";
import { getBeijingTimestamp, getDateParts } from "./utils/util_timezone.ts";
import type { FinalItem } from "./type/types.ts";

/** 分类 emoji 映射 */
const CATEGORY_EMOJI: Record<string, string> = {
  release: "🎮",
  update: "🔄",
  esports: "🏆",
  industry: "💼",
  review: "📝",
  rumor: "🔮",
  deal: "💰",
  hardware: "🖥️",
  mobile: "📱",
  indie: "🎨",
  console: "🎮",
  pc: "💻",
  japanese: "🇯🇵",
  culture: "🎭",
  development: "🛠️",
  default: "📰",
};

function getEmoji(category: string): string {
  return CATEGORY_EMOJI[category] || CATEGORY_EMOJI.default;
}

/** 生成 HTML 静态站点（参考 ai-digest.liziran.com 风格） */
export function generateSite(items: FinalItem[], date: string): void {
  const cfg = loadConfig();
  const { year, month, day } = getDateParts(date);
  const timestamp = getBeijingTimestamp();

  // 构建每日摘要（类似参考网站的列表式布局）
  const digestItems = items.map((item, index) => {
    const num = String(index + 1).padStart(2, "0");
    return `
          <li class="digest-item">
            <div class="digest-number">${num}</div>
            <div class="digest-content">
              <h3 class="digest-title">
                <a href="${item.link}" target="_blank" rel="noopener">${item.chineseTitle}</a>
              </h3>
              <p class="digest-fact">${item.analysis.fact}</p>
              ${item.analysis.importance ? `<p class="digest-importance">💡 ${item.analysis.importance}</p>` : ""}
              <div class="digest-meta">
                <span class="digest-source">${item.sourceName}</span>
                ${item.sourceCount > 1 ? `<span class="digest-multi">🔗 ${item.sourceCount}源</span>` : ""}
                <span class="digest-score">⭐ ${item.finalScore.toFixed(1)}</span>
                <span class="digest-category">${getEmoji(item.category)} ${item.category}</span>
              </div>
            </div>
          </li>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cfg.site.name_zh} - ${year}年${month}月${day}日</title>
<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:#faf9f7;color:#1a1a1a;line-height:1.7}
.container{max-width:720px;margin:0 auto;padding:24px}

/* Header */
header{text-align:center;padding:48px 0 32px;border-bottom:1px solid #e8e4dc}
.site-name{font-size:1.6em;font-weight:700;color:#1a1a1a;margin-bottom:8px}
.site-tagline{color:#6b6b6b;font-size:0.95em;margin-bottom:12px}
.site-date{font-size:1.1em;color:#3a3a3a}

/* Navigation */
nav{display:flex;justify-content:center;gap:24px;margin-top:20px;font-size:0.9em}
nav a{color:#6b6b6b;text-decoration:none;padding:4px 8px;border-radius:4px;transition:all 0.2s}
nav a:hover{color:#1a1a1a;background:#f0ede6}

/* Digest List */
.digest-list{list-style:none;margin-top:40px}
.digest-item{display:flex;gap:16px;padding:24px 0;border-bottom:1px solid #f0ede6;transition:background 0.2s}
.digest-item:hover{background:#faf9f7}
.digest-number{font-size:1.4em;font-weight:700;color:#c9a959;min-width:32px;text-align:right}
.digest-content{flex:1}
.digest-title{font-size:1.05em;font-weight:600;margin-bottom:8px;line-height:1.5}
.digest-title a{color:#1a1a1a;text-decoration:none;border-bottom:1px solid transparent;transition:border-color 0.2s}
.digest-title a:hover{border-bottom-color:#c9a959}
.digest-fact{font-size:0.95em;color:#4a4a4a;margin-bottom:6px;line-height:1.7}
.digest-importance{font-size:0.9em;color:#6b6b6b;background:#f8f6f0;padding:8px 12px;border-radius:6px;margin-bottom:8px}
.digest-meta{display:flex;flex-wrap:wrap;gap:12px;font-size:0.82em;color:#8b8b8b;margin-top:8px}
.digest-source{background:#f0ede6;padding:2px 8px;border-radius:4px}
.digest-multi{color:#c9a959;font-weight:500}
.digest-score{color:#c9a959;font-weight:600}
.digest-category{background:#f5f2eb;padding:2px 8px;border-radius:4px}

/* Footer */
footer{text-align:center;padding:40px 0 20px;border-top:1px solid #e8e4dc;margin-top:48px;color:#8b8b8b;font-size:0.85em}
footer a{color:#6b6b6b;text-decoration:none}
footer a:hover{color:#1a1a1a}
.footer-links{display:flex;justify-content:center;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.footer-links a{padding:4px 8px}

/* Responsive */
@media(max-width:600px){
  .container{padding:16px}
  .site-name{font-size:1.3em}
  .digest-item{padding:16px 0;gap:12px}
  .digest-number{font-size:1.2em;min-width:28px}
  .digest-title{font-size:1em}
  .digest-meta{gap:8px}
}
</style>
</head>
<body>
<div class="container">
<header>
<h1 class="site-name">${cfg.site.name_zh}</h1>
<p class="site-tagline">${cfg.site.description_zh}</p>
<p class="site-date">📅 ${year}年${month}月${day}日</p>
<nav>
<a href="index.html">首页</a>
<a href="../archive.html">存档</a>
<a href="../methodology.html">方法论</a>
<a href="../feed.xml">RSS</a>
</nav>
</header>

<ul class="digest-list">
${digestItems}
</ul>

<footer>
<div class="footer-links">
<a href="../archive.html">存档</a>
·
<a href="../methodology.html">方法论</a>
·
<a href="../feed.xml">RSS</a>
·
<a href="https://github.com/your-repo/games-radar" target="_blank" rel="noopener">GitHub</a>
</div>
<p>由 ${cfg.site.name_zh} 自动生成 · ${timestamp}</p>
<p>共收录 ${items.length} 条精选资讯 · <a href="sources.html">查看数据来源</a></p>
</footer>
</div>
</body>
</html>`;

  const dir = `dist/${date}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
  console.log(`📄 [generate] dist/${date}/index.html`);

  // 同时复制到 dist/index.html 作为最新版
  fs.writeFileSync("dist/index.html", html, "utf-8");

  // 生成存档页面
  generateArchivePage(items, date);

  // 生成方法论页面
  generateMethodologyPage();

  // 生成 RSS Feed
  generateRssFeed(items, date);

  // 生成数据来源页面
  generateSourcesPage();
}

/** 生成存档页面 */
function generateArchivePage(todayItems: FinalItem[], todayDate: string): void {
  const cfg = loadConfig();
  const timestamp = getBeijingTimestamp();

  // 读取所有历史 digest 文件
  const digestDir = "digests";
  let archives: { date: string; title: string; count: number }[] = [];

  if (fs.existsSync(digestDir)) {
    const files = fs.readdirSync(digestDir).filter(f => f.endsWith(".md")).sort().reverse();
    for (const file of files) {
      const date = file.replace(".md", "");
      if (date === todayDate) continue; // 跳过今天
      const content = fs.readFileSync(path.join(digestDir, file), "utf-8");
      const titleMatch = content.match(/^# .+\n/g);
      const title = titleMatch ? titleMatch[0].replace(/^# /, "").trim() : date;
      const countMatch = content.match(/共 (\d+) 条精选/);
      const count = countMatch ? parseInt(countMatch[1]) : 0;
      archives.push({ date, title, count });
    }
  }

  // 添加今天
  archives.unshift({
    date: todayDate,
    title: `${cfg.site.name_zh} - ${todayDate}`,
    count: todayItems.length,
  });

  const archiveItems = archives
    .map(
      (arch) => `
      <li class="archive-item">
        <a href="${arch.date}/index.html" class="archive-link">
          <span class="archive-date">${arch.date}</span>
          <span class="archive-title">${arch.title.replace(`${cfg.site.name_zh} - `, "")}</span>
          <span class="archive-count">${arch.count}条</span>
        </a>
      </li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>存档 - ${cfg.site.name_zh}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#faf9f7;color:#1a1a1a;line-height:1.7}
.container{max-width:720px;margin:0 auto;padding:24px}
header{text-align:center;padding:48px 0 32px;border-bottom:1px solid #e8e4dc}
.site-name{font-size:1.6em;font-weight:700;margin-bottom:8px}
.site-tagline{color:#6b6b6b;font-size:0.95em}
nav{display:flex;justify-content:center;gap:24px;margin-top:20px;font-size:0.9em}
nav a{color:#6b6b6b;text-decoration:none;padding:4px 8px;border-radius:4px}
nav a:hover{color:#1a1a1a;background:#f0ede6}
.archive-list{list-style:none;margin-top:40px}
.archive-item{border-bottom:1px solid #f0ede6}
.archive-link{display:flex;justify-content:space-between;align-items:center;padding:16px 0;text-decoration:none;color:inherit;transition:background 0.2s}
.archive-link:hover{background:#faf9f7}
.archive-date{font-weight:600;color:#1a1a1a;min-width:140px}
.archive-title{flex:1;color:#4a4a4a}
.archive-count{color:#8b8b8b;font-size:0.9em}
footer{text-align:center;padding:40px 0 20px;border-top:1px solid #e8e4dc;margin-top:48px;color:#8b8b8b;font-size:0.85em}
footer a{color:#6b6b6b;text-decoration:none}
</style>
</head>
<body>
<div class="container">
<header>
<h1 class="site-name">${cfg.site.name_zh}</h1>
<p class="site-tagline">${cfg.site.description_zh}</p>
<nav>
<a href="index.html">首页</a>
<a href="archive.html">存档</a>
<a href="methodology.html">方法论</a>
<a href="feed.xml">RSS</a>
</nav>
</header>

<h2 style="margin-top:32px;font-size:1.3em;">📚 历史存档</h2>
<ul class="archive-list">
${archiveItems}
</ul>

<footer>
<p>由 ${cfg.site.name_zh} 自动生成 · ${timestamp}</p>
</footer>
</div>
</body>
</html>`;

  fs.writeFileSync("dist/archive.html", html, "utf-8");
  console.log(`📄 [generate] dist/archive.html`);
}

/** 生成方法论页面 */
function generateMethodologyPage(): void {
  const cfg = loadConfig();
  const timestamp = getBeijingTimestamp();

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>方法论 - ${cfg.site.name_zh}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#faf9f7;color:#1a1a1a;line-height:1.8}
.container{max-width:720px;margin:0 auto;padding:24px}
header{text-align:center;padding:48px 0 32px;border-bottom:1px solid #e8e4dc}
.site-name{font-size:1.6em;font-weight:700;margin-bottom:8px}
.site-tagline{color:#6b6b6b;font-size:0.95em}
nav{display:flex;justify-content:center;gap:24px;margin-top:20px;font-size:0.9em}
nav a{color:#6b6b6b;text-decoration:none;padding:4px 8px;border-radius:4px}
nav a:hover{color:#1a1a1a;background:#f0ede6}
.content{margin-top:40px}
.content h2{font-size:1.4em;font-weight:700;margin:32px 0 16px;color:#1a1a1a}
.content h3{font-size:1.1em;font-weight:600;margin:24px 0 12px;color:#3a3a3a}
.content p{margin-bottom:16px;color:#4a4a4a}
.content ul{margin:16px 0 16px 24px;color:#4a4a4a}
.content li{margin-bottom:8px}
.content code{background:#f0ede6;padding:2px 6px;border-radius:4px;font-family:"SF Mono",Monaco,monospace;font-size:0.9em}
.content pre{background:#f5f2eb;padding:16px;border-radius:8px;overflow-x:auto;margin:16px 0}
.content pre code{background:transparent;padding:0}
.table-wrapper{overflow-x:auto;margin:16px 0}
table{width:100%;border-collapse:collapse;font-size:0.9em}
th,td{padding:12px;text-align:left;border-bottom:1px solid #e8e4dc}
th{background:#f5f2eb;font-weight:600}
.highlight{background:#fff9db;padding:16px;border-radius:8px;margin:16px 0;border-left:3px solid #c9a959}
footer{text-align:center;padding:40px 0 20px;border-top:1px solid #e8e4dc;margin-top:48px;color:#8b8b8b;font-size:0.85em}
footer a{color:#6b6b6b;text-decoration:none}
</style>
</head>
<body>
<div class="container">
<header>
<h1 class="site-name">${cfg.site.name_zh}</h1>
<p class="site-tagline">${cfg.site.description_zh}</p>
<nav>
<a href="index.html">首页</a>
<a href="archive.html">存档</a>
<a href="methodology.html">方法论</a>
<a href="feed.xml">RSS</a>
</nav>
</header>

<div class="content">
<h2>📊 筛选与评分方法论</h2>
<p>「看点啥」采用 AI 驱动的三智能体编辑部流程，确保每日精选内容的质量和相关性。以下是我们的筛选和评分机制详解。</p>

<h3>1. 数据来源</h3>
<p>我们聚合了 <strong>15+ 个权威游戏资讯源</strong>，按权威性分为 5 个层级（Tier）：</p>
<div class="table-wrapper">
<table>
<tr><th>Tier</th><th>加成</th><th>示例</th></tr>
<tr><td>Tier 1</td><td>+20</td><td>PlayStation Blog, Xbox Wire, Nintendo（平台官方）</td></tr>
<tr><td>Tier 2</td><td>+15</td><td>IGN, Polygon, GamesIndustry.biz（权威媒体）</td></tr>
<tr><td>Tier 3</td><td>+10</td><td>Eurogamer, PC Gamer, GameSpot（专业媒体）</td></tr>
<tr><td>Tier 4</td><td>+5</td><td>Kotaku, Game Rant（综合媒体）</td></tr>
<tr><td>Tier 5</td><td>+0</td><td>Reddit r/Games（社区）</td></tr>
</table>
</div>

<h3>2. 交叉验证去重</h3>
<p>使用基于关键词的 <strong>Jaccard 相似系数</strong> 计算标题相似度，阈值设为 0.7。相似标题会被合并，并记录多源报道。被多个媒体报道的资讯会获得额外加分。</p>

<h3>3. 评分公式</h3>
<div class="highlight">
<p><strong>基础分 (0-100)</strong> = 行业影响力 (0-30) + 受众广度 (0-20) + 稀缺性 (0-20) + 后续跟踪性 (0-15) + 可操作性 (0-15)</p>
</div>

<div class="table-wrapper">
<table>
<tr><th>维度</th><th>权重</th><th>评分标准</th></tr>
<tr><td>行业影响力</td><td>0-30</td><td>大厂动态/大作发售/平台政策 → 25-30 分；中型工作室 → 15-24 分；小工作室 → 5-14 分</td></tr>
<tr><td>受众广度</td><td>0-20</td><td>跨平台/全球性 → 15-20 分；单平台/单地区 → 8-14 分；极小众 → 0-7 分</td></tr>
<tr><td>稀缺性</td><td>0-20</td><td>一手公告/独家 → 15-20 分；首发报道 → 8-14 分；跟踪报道 → 0-7 分</td></tr>
<tr><td>后续跟踪性</td><td>0-15</td><td>确定有后续 → 10-15 分；可能有 → 5-9 分；一次性 → 0-4 分</td></tr>
<tr><td>可操作性</td><td>0-15</td><td>玩家可立即行动 → 10-15 分；需关注等待 → 5-9 分；纯信息 → 0-4 分</td></tr>
</table>
</div>

<h3>4. 最终分数计算</h3>
<div class="highlight">
<p><strong>最终分数</strong> = 基础分 + 来源权威加成 + 多源交叉加成 + 时效性加成 - 历史重复惩罚</p>
</div>

<ul>
<li><strong>来源权威加成</strong>：Tier 1 (+20) / Tier 2 (+15) / Tier 3 (+10) / Tier 4 (+5) / Tier 5 (+0)</li>
<li><strong>多源交叉加成</strong>：(source_count - 1) × 12，封顶 +36</li>
<li><strong>时效性加成</strong>：6 小时内 (+10) / 12 小时内 (+5) / 24 小时内 (0) / 超过 24 小时 (-5)</li>
<li><strong>历史重复惩罚</strong>：与前 3 天报道相似度&gt;0.7 (-50) / 相似度&gt;0.6 (-20)</li>
</ul>

<h3>5. AI 编辑部流程</h3>
<p>三智能体协作，确保内容质量：</p>
<ul>
<li><strong>Editor（主编）</strong>：评估每条资讯的基础分，筛选候选列表，确保领域多样性（每领域最多 4 条）</li>
<li><strong>Writer（写手）</strong>：翻译标题为简洁中文，撰写三段式分析（事实→重要性→趋势），提取标签</li>
<li><strong>Reviewer（审核）</strong>：标题党检测、事实核查、完整性检查、合规性审查、重复检测</li>
</ul>

<h3>6. 质量控制</h3>
<h4>程序级检查</h4>
<ul>
<li>标题党关键词过滤（炸裂、震撼、杀疯了、全网刷屏、重磅、惊天、史诗级等）</li>
<li>敏感内容检测</li>
<li>格式验证</li>
</ul>

<h4>AI 审核</h4>
<ul>
<li>事实核查：分析与原文一致性，防止捏造</li>
<li>完整性检查：事实/重要性/趋势三段是否都有实质内容</li>
<li>重复检测：对比前 3 天历史，避免重复报道</li>
<li>合规性审查：无敏感政治内容、无歧视性内容</li>
</ul>

<h3>7. 输出限制</h3>
<ul>
<li>每日最多展示 <strong>12 条</strong>（4 条 top + 8 条 normal）</li>
<li>同一领域最多 <strong>4 条</strong>，确保多样性</li>
<li>禁止使用标题党用语</li>
</ul>

<h3>8. 技术实现</h3>
<p>使用 <code>DeepSeek-V3</code> 模型进行 AI 分析和内容生成，通过 YAML 配置管理评分参数和提示词。所有数据处理在本地完成，确保隐私和安全。</p>

<h3>9. 透明度承诺</h3>
<p>我们承诺：</p>
<ul>
<li>不接商单，保持独立性</li>
<li>公开评分标准和方法论</li>
<li>如实呈现一手信源内容</li>
<li>不夸张、不炸裂、不标题党</li>
</ul>
</div>

<footer>
<p>由 ${cfg.site.name_zh} 自动生成 · ${timestamp}</p>
<p><a href="../index.html">返回首页</a></p>
</footer>
</div>
</body>
</html>`;

  fs.writeFileSync("dist/methodology.html", html, "utf-8");
  console.log(`📄 [generate] dist/methodology.html`);
}

/** 生成 RSS Feed */
function generateRssFeed(items: FinalItem[], date: string): void {
  const cfg = loadConfig();
  const timestamp = getBeijingTimestamp();

  const itemXml = items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.chineseTitle)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid>${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.analysis.fact)}</description>
      <source>${escapeXml(item.sourceName)}</source>
      <pubDate>${new Date(item.timestamp).toUTCString()}</pubDate>
    </item>`
    )
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${cfg.site.name_zh}</title>
  <description>${cfg.site.description_zh}</description>
  <link>https://your-domain.com/</link>
  <atom:link href="https://your-domain.com/feed.xml" rel="self" type="application/rss+xml"/>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${itemXml}
</channel>
</rss>`;

  fs.writeFileSync("dist/feed.xml", rss, "utf-8");
  console.log(`📄 [generate] dist/feed.xml`);
}

/** 生成数据来源页面 */
function generateSourcesPage(): void {
  const cfg = loadConfig();
  const timestamp = getBeijingTimestamp();
  const sources = loadSources();

  const tierGroups: Record<number, typeof sources> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const source of sources) {
    tierGroups[source.tier]?.push(source);
  }

  const sourcesHtml = Object.entries(tierGroups)
    .map(([tier, sources]) => {
      const tierNames: Record<string, string> = {
        "1": "Tier 1 - 平台官方",
        "2": "Tier 2 - 权威媒体",
        "3": "Tier 3 - 专业媒体",
        "4": "Tier 4 - 综合媒体",
        "5": "Tier 5 - 社区",
      };
      const sourceItems = sources
        .map((s) => `<li><strong>${s.name}</strong> (${s.category})</li>`)
        .join("");
      return `
      <div class="tier-section">
        <h3>${tierNames[tier]}</h3>
        <ul>${sourceItems}</ul>
      </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>数据来源 - ${cfg.site.name_zh}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#faf9f7;color:#1a1a1a;line-height:1.8}
.container{max-width:720px;margin:0 auto;padding:24px}
header{text-align:center;padding:48px 0 32px;border-bottom:1px solid #e8e4dc}
.site-name{font-size:1.6em;font-weight:700;margin-bottom:8px}
.site-tagline{color:#6b6b6b;font-size:0.95em}
nav{display:flex;justify-content:center;gap:24px;margin-top:20px;font-size:0.9em}
nav a{color:#6b6b6b;text-decoration:none;padding:4px 8px;border-radius:4px}
nav a:hover{color:#1a1a1a;background:#f0ede6}
.content{margin-top:40px}
.content h2{font-size:1.4em;font-weight:700;margin-bottom:24px}
.tier-section{margin-bottom:24px;padding:16px;background:#fff;border-radius:8px}
.tier-section h3{font-size:1.1em;font-weight:600;margin-bottom:12px;color:#c9a959}
.tier-section ul{list-style:none}
.tier-section li{padding:4px 0;color:#4a4a4a}
footer{text-align:center;padding:40px 0 20px;border-top:1px solid #e8e4dc;margin-top:48px;color:#8b8b8b;font-size:0.85em}
footer a{color:#6b6b6b;text-decoration:none}
</style>
</head>
<body>
<div class="container">
<header>
<h1 class="site-name">${cfg.site.name_zh}</h1>
<p class="site-tagline">${cfg.site.description_zh}</p>
<nav>
<a href="index.html">首页</a>
<a href="archive.html">存档</a>
<a href="methodology.html">方法论</a>
<a href="feed.xml">RSS</a>
</nav>
</header>

<div class="content">
<h2>📰 数据来源</h2>
<p>我们聚合了 ${sources.length} 个权威游戏资讯源，按权威性分层：</p>
${sourcesHtml}
</div>

<footer>
<p>由 ${cfg.site.name_zh} 自动生成 · ${timestamp}</p>
<p><a href="../index.html">返回首页</a></p>
</footer>
</div>
</body>
</html>`;

  fs.writeFileSync("dist/sources.html", html, "utf-8");
  console.log(`📄 [generate] dist/sources.html`);
}

/** XML 转义 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 加载 RSS 源配置 */
function loadSources(): Array<{ id: string; name: string; tier: number; category: string }> {
  const yaml = fs.readFileSync("config/sources.yaml", "utf-8");
  const sources: Array<{ id: string; name: string; tier: number; category: string }> = [];

  const tierMatches = yaml.matchAll(/tier(\d+):([\s\S]*?)(?=tier\d+:|$)/g);
  for (const match of tierMatches) {
    const tier = parseInt(match[1]);
    const tierContent = match[2];
    const sourceMatches = tierContent.matchAll(/- id: (\S+)\s+name: ([^\n]+)\s+url: ([^\n]+)\s+type: (\S+)\s+category: (\S+)/g);
    for (const m of sourceMatches) {
      sources.push({
        id: m[1],
        name: m[2].trim(),
        tier,
        category: m[5],
      });
    }
  }

  return sources;
}

/** 生成 Markdown 日报 */
export function generateDigest(items: FinalItem[], date: string): void {
  const cfg = loadConfig();
  const { year, month, day } = getDateParts(date);
  const topItems = items.filter((i) => i.priority === "top");
  const normalItems = items.filter((i) => i.priority !== "top");

  let md = `# ${cfg.site.name_zh} - ${year}年${month}月${day}日\n\n`;
  md += `> ${cfg.site.description_zh}\n\n`;

  if (topItems.length > 0) {
    md += `## 🔥 今日头条\n\n`;
    for (const item of topItems) {
      md += `### ${getEmoji(item.category)} ${item.chineseTitle}\n\n`;
      md += `${item.analysis.fact}\n\n`;
      if (item.analysis.importance) md += `💡 ${item.analysis.importance}\n\n`;
      md += `🔗 [原文](${item.link}) · 来源：${item.sourceName}`;
      if (item.sourceCount > 1) md += ` · ${item.sourceCount}源报道`;
      md += ` · ⭐ ${item.finalScore.toFixed(1)}\n\n`;
      if (item.tags.length > 0) md += `标签：${item.tags.map((t) => `\`${t}\``).join(" ")}\n\n`;
      md += `---\n\n`;
    }
  }

  if (normalItems.length > 0) {
    md += `## 📋 更多资讯\n\n`;
    for (const item of normalItems) {
      md += `- ${getEmoji(item.category)} **${item.chineseTitle}** - ${item.analysis.fact} [原文](${item.link}) ⭐${item.finalScore.toFixed(1)}\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*由 ${cfg.site.name_zh} 自动生成 · 共 ${items.length} 条精选*\n`;

  // 保存到 digests 目录
  const digestDir = "digests";
  fs.mkdirSync(digestDir, { recursive: true });
  fs.writeFileSync(path.join(digestDir, `${date}.md`), md, "utf-8");
  console.log(`📝 [generate] digests/${date}.md`);

  // 也保存到 dist
  const distDir = `dist/${date}`;
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, "digest.md"), md, "utf-8");
}
