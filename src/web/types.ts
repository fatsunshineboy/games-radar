/**
 * Web 生成器类型定义
 */

/** 摘要信息（用于主页卡片） */
export interface DigestSummary {
  date: string;
  totalCount: number;
  topThree: Array<{
    number: string;
    emoji: string;
    title: string;
  }>;
}

/** 页面生成配置 */
export interface WebConfig {
  siteName: string;
  siteNameEn: string;
  description: string;
  baseUrl: string;
}

/** 详情条目（用于详情页） */
export interface DetailItem {
  number: string;
  emoji: string;
  title: string;
  link: string;
  source: string;
  sourceCount: number;
  score: number;
  category: string;
  article: string;
  tags: string[];
}