/**
 * 方法论页面生成器
 */

import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../type/types.ts";

export function generateMethodologyPage(
  cfg: AppConfig,
  distDir: string
): void {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>方法论 - ${cfg.site.name_zh}</title>
<style>
${METHODOLOGY_STYLES}
</style>
</head>
<body>
<div class="container">
<header>
<h1 class="site-name">${cfg.site.name_zh}</h1>
<p class="site-tagline">${cfg.site.description_zh}</p>
<nav>
<a href="index.html">首页</a>
<a href="methodology.html">方法论</a>
<a href="feed.xml">RSS</a>
</nav>
</header>

<div class="content">
<h2>📊 筛选与评分方法论</h2>
<p>「${cfg.site.name_zh}」采用 AI 驱动的三智能体编辑部流程，确保每日精选内容的质量和相关性。</p>

<h3>1. 数据来源</h3>
<p>我们聚合了 <strong>15+ 个权威游戏资讯源</strong>，按权威性分为 5 个层级：</p>
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
<p>使用基于关键词的 <strong>Jaccard 相似系数</strong> 计算标题相似度，阈值设为 0.7。相似标题会被合并，并记录多源报道。</p>

<h3>3. 评分公式</h3>
<div class="highlight">
<p><strong>基础分 (0-100)</strong> = 行业影响力 (0-30) + 受众广度 (0-20) + 稀缺性 (0-20) + 后续跟踪性 (0-15) + 可操作性 (0-15)</p>
</div>

<h3>4. 最终分数计算</h3>
<div class="highlight">
<p><strong>最终分数</strong> = 基础分 + breakdown总分 + 来源权威加成 + 多源交叉加成 + 时效性加成 - 历史重复惩罚</p>
</div>

<h3>5. AI 编辑部流程</h3>
<p>三智能体协作：</p>
<ul>
<li><strong>Editor（主编）</strong>：评估筛选，确保领域多样性</li>
<li><strong>Writer（写手）</strong>：翻译标题，撰写三段式分析（事实→重要性→趋势）</li>
<li><strong>Reviewer（审核）</strong>：标题党检测、事实核查、修订循环</li>
</ul>

<h3>6. Writer-Reviewer 循环机制</h3>
<p>Reviewer 发现问题时将内容打回 Writer 修订，最多循环 5 次，确保质量达标。</p>

<h3>7. 质量控制</h3>
<ul>
<li>标题党关键词过滤（炸裂、震撼、杀疯了、重磅、惊天、史诗级等）</li>
<li>事实核查：对比原文与分析文章，防止捏造</li>
<li>历史重复检测：对比前 3 天报道</li>
</ul>

<h3>8. 输出限制</h3>
<ul>
<li>每日最多展示 <strong>16 条</strong>（6 条 top + 10 条 normal）</li>
<li>同一领域最多 <strong>4 条</strong>，确保多样性</li>
</ul>

<h3>9. 透明度承诺</h3>
<ul>
<li>不接商单，保持独立性</li>
<li>公开评分标准和方法论</li>
<li>如实呈现一手信源内容</li>
<li>不夸张、不炸裂、不标题党</li>
</ul>
</div>

<footer>
<div class="footer-links">
<a href="index.html">首页</a> ·
<a href="feed.xml">RSS</a>
</div>
<p>由 ${cfg.site.name_zh} 自动生成</p>
</footer>
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(distDir, "methodology.html"), html, "utf-8");
  console.log(`📄 [web] ${distDir}/methodology.html`);
}

const METHODOLOGY_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #faf9f7;
  color: #1a1a1a;
  line-height: 1.8;
}
.container { max-width: 720px; margin: 0 auto; padding: 24px; }

/* Header */
header { text-align: center; padding: 48px 0 32px; border-bottom: 1px solid #e8e4dc; }
.site-name { font-size: 1.6em; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
.site-tagline { color: #6b6b6b; font-size: 0.95em; margin-bottom: 12px; }
nav { display: flex; justify-content: center; gap: 24px; margin-top: 20px; font-size: 0.9em; }
nav a { color: #6b6b6b; text-decoration: none; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
nav a:hover { color: #1a1a1a; background: #f0ede6; }

/* Content */
.content { margin-top: 40px; }
.content h2 { font-size: 1.4em; font-weight: 700; margin: 32px 0 16px; color: #1a1a1a; }
.content h3 { font-size: 1.1em; font-weight: 600; margin: 24px 0 12px; color: #3a3a3a; }
.content p { margin-bottom: 16px; color: #4a4a4a; }
.content ul { margin: 16px 0 16px 24px; color: #4a4a4a; }
.content li { margin-bottom: 8px; }

.table-wrapper { overflow-x: auto; margin: 16px 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e8e4dc; }
th { background: #f5f2eb; font-weight: 600; }

.highlight { background: #fff9db; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #c9a959; }

/* Footer */
footer { text-align: center; padding: 40px 0 20px; border-top: 1px solid #e8e4dc; margin-top: 48px; color: #8b8b8b; font-size: 0.85em; }
footer a { color: #6b6b6b; text-decoration: none; }
footer a:hover { color: #1a1a1a; }
.footer-links { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; }

@media (max-width: 600px) {
  .container { padding: 16px; }
  .site-name { font-size: 1.3em; }
}
`;