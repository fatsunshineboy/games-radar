/**
 * LLM 调用器 - OpenAI Compatible API
 */

import fs from "node:fs";
import yaml from "js-yaml";
import type { AppConfig, PromptConfig, Source } from "./types.ts";

// ============ 配置加载 ============

let _config: AppConfig | null = null;
let _prompts: PromptConfig | null = null;
let _sources: Source[] | null = null;
let _callCount = 0;

/** 解析环境变量占位符 ${VAR_NAME} */
function resolveEnvVar(value: string): string {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{(\w+)\}/g, (_match, varName) => {
    return process.env[varName] || "";
  });
}

/** 加载主配置 */
export function loadConfig(): AppConfig {
  if (!_config) {
    const raw = yaml.load(fs.readFileSync("config/config.yaml", "utf-8")) as Record<string, unknown>;
    const llm = raw["llm"] as Record<string, unknown>;

    _config = {
      llm: {
        api_key: resolveEnvVar(llm["api_key"] as string),
        base_url: resolveEnvVar(llm["base_url"] as string) || "https://api.openai.com/v1",
        model: resolveEnvVar(llm["model"] as string) || "gpt-4o-mini",
        temperature: (llm["temperature"] as number) ?? 0.3,
        max_tokens: (llm["max_tokens"] as number) ?? 4096,
        daily_budget: (llm["daily_budget"] as number) ?? 200,
      },
      collection: raw["collection"] as AppConfig["collection"],
      deduplication: raw["deduplication"] as AppConfig["deduplication"],
      scoring: raw["scoring"] as AppConfig["scoring"],
      output: raw["output"] as AppConfig["output"],
      site: raw["site"] as AppConfig["site"],
    };
  }
  return _config;
}

/** 加载提示词 */
export function loadPrompts(): PromptConfig {
  if (!_prompts) {
    _prompts = yaml.load(fs.readFileSync("config/prompts.yaml", "utf-8")) as PromptConfig;
  }
  return _prompts;
}

/** 加载RSS源列表（从 sources.yaml，按tier展平） */
export function loadSources(): Source[] {
  if (!_sources) {
    const raw = yaml.load(fs.readFileSync("config/sources.yaml", "utf-8")) as Record<string, unknown>;
    _sources = [];

    for (let tier = 1; tier <= 5; tier++) {
      const key = `tier${tier}`;
      const list = raw[key] as Array<Record<string, unknown>> | undefined;
      if (list) {
        for (const item of list) {
          _sources.push({
            id: item["id"] as string,
            name: item["name"] as string,
            url: item["url"] as string,
            type: item["type"] as string,
            category: item["category"] as string,
            tier,
            priority: item["priority"] as string | undefined,
          });
        }
      }
    }
  }
  return _sources;
}

// ============ LLM 调用 ============

/** 调用 LLM（OpenAI 兼容 API） */
export async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const cfg = loadConfig();

  if (!cfg.llm.api_key) {
    throw new Error("缺少 API Key，请设置环境变量 OPENAI_API_KEY");
  }

  _callCount++;
  if (_callCount > cfg.llm.daily_budget) {
    console.warn(`⚠️  [llm] 调用次数超预算: ${_callCount}/${cfg.llm.daily_budget}`);
  }

  const url = `${cfg.llm.base_url}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.llm.api_key}`,
    },
    body: JSON.stringify({
      model: cfg.llm.model,
      max_tokens: cfg.llm.max_tokens,
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
  // 尝试提取 ```json ... ``` 块
  const jsonBlockMatch = text.match(/```json?\s*\n?([\s\S]*?)\n?\s*```/);
  const cleaned = jsonBlockMatch ? jsonBlockMatch[1].trim() : text.trim();
  return JSON.parse(cleaned) as T;
}

/** 获取 LLM 调用计数 */
export function getCallCount(): number {
  return _callCount;
}

// ============ 文件工具 ============

/** 确保目录存在并保存 JSON */
export function saveJson(filepath: string, data: unknown): void {
  const dir = filepath.substring(0, filepath.lastIndexOf("/"));
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
}

/** 读取 JSON 文件（不存在返回 null） */
export function readJson<T>(filepath: string): T | null {
  try {
    const content = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
