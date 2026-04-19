/**
 * 共享类型定义
 */

/** RSS源定义 */
export interface Source {
  id: string;
  name: string;
  url: string;
  type: string;
  category: string;
  tier: number;        // 1-5 权威性等级
  priority?: string;
}

/** 原始新闻条目 */
export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;       // 源ID
  sourceName: string;   // 源名称
  tier: number;         // 源的权威等级
  category: string;     // 领域分类
  description: string;  // 简短描述
  content: string;      // 文章内容
  sourceCount: number;  // 被多少个源报道
  allSources: string[]; // 所有来源ID
  timestamp: string;    // 北京时间 ISO
  pubDate: string;      // 原始发布时间
}

/** 编辑评分明细 */
export interface ScoreBreakdown {
  influence: number;    // 行业影响力 0-30
  audience: number;     // 受众广度 0-20
  scarcity: number;     // 稀缺性 0-20
  followup: number;     // 后续跟踪性 0-15
  actionable: number;   // 可操作性 0-15
}

/** 编辑筛选后的候选条目 */
export interface CandidateItem extends NewsItem {
  baseScore: number;        // Editor打的基础分
  scoreBreakdown: ScoreBreakdown;
  breakdownTotal: number;   // breakdown 各项求和
  tierBonus: number;        // 来源权威加成
  crossBonus: number;       // 多源交叉加成
  freshnessBonus: number;   // 时效性加成
  historyPenalty: number;   // 重复惩罚
  finalScore: number;       // 最终分数
  reason: string;           // 入选理由
  priority: "top" | "normal";
}

/** 写手撰写后的条目 */
export interface DraftedItem extends CandidateItem {
  chineseTitle: string;
  article: string;
  tags: string[];
  revisionCount: number;        // 当前修订次数
  reviewSuggestions?: string;   // 审核建议（修订时使用）
}

/** 审核结果 */
export interface ReviewResult {
  passed: FinalItem[];      // 通过
  toRevise: DraftedItem[];  // 需重写（含 suggestions）
  rejected: FinalItem[];    // 拒绝
}

/** 审核后的最终条目 */
export interface FinalItem extends DraftedItem {
  reviewDecision: "pass" | "revise" | "reject";
  reviewReason: string;
  reviewSuggestions: string;
}

/** 原始数据包 */
export interface RawData {
  date: string;
  fetchedAt: string;
  items: NewsItem[];
  sourceStats: Record<string, number>; // 每个源抓取了多少条
}

/** 历史摘要（用于去重） */
export interface HistorySummary {
  date: string;
  titles: string[];       // 已报道的标题列表
  chineseTitles: string[]; 
  articles: string[];     // 已报道的文章内容列表
}

/** 配置类型 */
export interface AppConfig {
  llm: {
    api_key: string;
    base_url: string;
    model: string;
    temperature: number;
    max_tokens: number;
    daily_budget: number;
    editor_batch_size:number;
  };
  collection: {
    rate_limit_ms: number;
    max_per_source: number;
    fetch_content: boolean;
    content_max_length: number;
  };
  deduplication: {
    similarity_threshold: number;
    boost_per_source: number;
  };
  scoring: {
    source_tier_bonus: Record<string, number>;
    cross_source_bonus: number;
    max_cross_bonus: number;
    freshness: Record<string, number>;
    history_penalty: {
      similarity_medium: number;
      similarity_high: number;
      lookback_days: number;
    };
  };
  output: {
    max_items: number;
    max_per_category: number;
    top_count: number;
    normal_count: number;
    max_revisions: number;
  };
  site: {
    name_zh: string;
    name_en: string;
    description_zh: string;
    description_en: string;
    base_url: string;
  };
}

/** 提示词配置 */
export interface PromptConfig {
  editor: { system: string; user: string };
  writer: { system: string; user: string };
  reviewer: { system: string; user: string };
}
