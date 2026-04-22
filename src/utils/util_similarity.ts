// ============ 标题相似度 ============

import { loadEntities } from './util_config.ts';

/** 构建别名归一化映射 */
function buildAliasMap(): Map<string, string> {
  const entities = loadEntities();
  const aliasMap = new Map<string, string>();

  // 从 entities.yaml 的 aliases 加载
  for (const [alias, canonical] of Object.entries(entities.aliases || {})) {
    aliasMap.set(alias.toLowerCase(), canonical.toLowerCase());
  }

  return aliasMap;
}

/** 归一化实体名（使用别名映射） */
function normalizeEntity(entity: string, aliasMap: Map<string, string>): string {
  const lower = entity.toLowerCase();
  return aliasMap.get(lower) || lower;
}

/** 获取所有已知实体（扁平化） */
function getAllKnownEntities(): string[] {
  const entities = loadEntities();
  const result: string[] = [];

  // 添加各分类实体
  for (const key of ['products', 'companies', 'game_series', 'hardware'] as const) {
    const list = entities[key] as string[] | undefined;
    if (list) result.push(...list);
  }

  return result;
}

/** 从标题中提取关键实体（归一化后） */
function extractEntities(title: string): Set<string> {
  const lower = title.toLowerCase();
  const entities = new Set<string>();
  const knownEntities = getAllKnownEntities();
  const aliasMap = buildAliasMap();

  // 1. 匹配已知实体（最长匹配优先），并归一化
  const sortedEntities = [...knownEntities].sort((a, b) => b.length - a.length);
  for (const entity of sortedEntities) {
    if (lower.includes(entity.toLowerCase())) {
      entities.add(normalizeEntity(entity, aliasMap));
    }
  }

  // 2. 提取书名号内的内容（中文游戏名常见格式），并归一化
  const bookTitleMatches = title.match(/《([^》]+)》/g);
  if (bookTitleMatches) {
    for (const m of bookTitleMatches) {
      const name = m.replace(/[《》]/g, '').toLowerCase();
      entities.add(normalizeEntity(name, aliasMap));
    }
  }

  // 3. 提取英文大写词（可能是缩写或产品名，长度>=2），并归一化
  const upperMatches = title.match(/[A-Z][A-Z0-9]+/g);
  if (upperMatches) {
    for (const m of upperMatches) {
      if (m.length >= 2) {
        entities.add(normalizeEntity(m, aliasMap));
      }
    }
  }

  return entities;
}

/** 检查动作词是否匹配（使用同义词组） */
function hasCommonActionWords(textA: string, textB: string): boolean {
  const entities = loadEntities();
  const actionGroups = entities.action_groups || {};

  // 提取标题中的动作词组名
  const extractActionGroups = (text: string): Set<string> => {
    const found = new Set<string>();
    const lower = text.toLowerCase();

    // 检查每个同义词组
    for (const [groupName, words] of Object.entries(actionGroups)) {
      for (const word of words) {
        if (lower.includes(word.toLowerCase())) {
          found.add(groupName); // 用组名代表同义词
          break; // 找到一个即可，跳出词循环
        }
      }
    }

    return found;
  };

  const groupsA = extractActionGroups(textA);
  const groupsB = extractActionGroups(textB);

  // 如果有共同的动作组
  const commonGroups = [...groupsA].filter(g => groupsB.has(g));
  return commonGroups.length > 0;
}

/** 计算标题相似度（关键实体优先 + Jaccard兜底） */
function titleSimilarity(a: string, b: string): number {
  const textA = a.toLowerCase();
  const textB = b.toLowerCase();

  // 1. 提取关键实体
  const entitiesA = extractEntities(textA);
  const entitiesB = extractEntities(textB);

  // 2. 如果有 >= 2 个相同实体，直接判定为高相似度
  const commonEntities = [...entitiesA].filter(e => entitiesB.has(e));
  if (commonEntities.length >= 2) {
    return 0.85; // 高相似度，触发 history_penalty.similarity_high
  }

  // 3. 如果有1个相同实体，检查动作词是否也相同
  if (commonEntities.length === 1) {
    if (hasCommonActionWords(textA, textB)) {
      return 0.65; // 触发medium penalty
    }
  }

  // 4. 兜底：原有Jaccard相似度（基于n-gram分词）
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = tokensA.size + tokensB.size - intersection;

  return union > 0 ? intersection / union : 0;
}

/** 分词：英文按空格，中文按字符n-gram */
function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();

  // 英文单词（按空格分割，保留>2字符的）
  const words = text.split(/\s+/).filter(w => w.length > 2);
  for (const w of words) {
    tokens.add(w);
  }

  // 中文/混合文本：使用2-gram提取字符组合
  const chars = text.replace(/[a-z0-9\s]/gi, '');
  for (let i = 0; i < chars.length - 1; i++) {
    tokens.add(chars.slice(i, i + 2));
  }

  return tokens;
}

export { titleSimilarity, extractEntities, getAllKnownEntities };