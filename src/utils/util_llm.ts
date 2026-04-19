import { loadConfig } from "./util_config.ts";

let _callCount = 0;

/** 调用 LLM（OpenAI 兼容 API） */
export async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const cfg = loadConfig();

  if (!cfg.llm.api_key) {
    throw new Error("缺少 API Key，请设置环境变量 OPENAI_API_KEY");
  }

  _callCount++;
  // if (_callCount > cfg.llm.daily_budget) {
  //   console.warn(`⚠️  [llm] 调用次数超预算: ${_callCount}/${cfg.llm.daily_budget}`);
  // }

  const url = `${cfg.llm.base_url}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.llm.api_key}`,
    },
    body: JSON.stringify({
      model: cfg.llm.model,
      // max_tokens: cfg.llm.max_tokens,
      temperature: cfg.llm.temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM 错误 ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message?: { content?: string } }>;
  };

  return data.choices[0]?.message?.content || "";
}

/** 从 LLM 响应中解析 JSON */
export function parseJson<T>(text: string): T {
  // 1. 尝试提取最后一个标记为 json 的代码块
  const jsonBlockMatch = text.match(/```json?\s*([\s\S]*?)```/gi);
  if (jsonBlockMatch) {
    const lastBlock = jsonBlockMatch[jsonBlockMatch.length - 1];
    const content = lastBlock.replace(/```json?\s*|```/gi, "").trim();
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      // 如果块内解析失败，回退到全局搜索
    }
  }

  // 2. 启发式：寻找第一个 '{' 或 '[' 到最后一个 '}' 或 ']' 之间的内容
  // 这能有效过滤掉代码块外的解释性文字
  const rangeMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (rangeMatch) {
    try {
      return JSON.parse(rangeMatch[0].trim()) as T;
    } catch (e) {
      // 继续尝试下一步
    }
  }

  // 3. 最后手段：直接尝试解析处理后的原始文本
  const cleaned = text.trim();
  return JSON.parse(cleaned) as T;
}

/** 获取 LLM 调用计数 */
export function getCallCount(): number {
  return _callCount;
}