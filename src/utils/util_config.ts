import yaml from "js-yaml";
import type { AppConfig, PromptConfig, Source } from "../type/types.ts";
import fs from "node:fs";

// ============ 配置加载 ============

let _config: AppConfig | null = null;
let _prompts: PromptConfig | null = null;
let _sources: Source[] | null = null;
let _callCount = 0;

/** 解析环境变量占位符 ${VAR_NAME} */
function resolveEnvVar(value: string): string {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{(\w+)\}/g, (_match, varName) => {
    return process.env[varName] ?? "";
  });
}

/** 加载主配置 */
export function loadConfig(): AppConfig {
  if (!_config) {
    const raw = yaml.load(fs.readFileSync("../config/config.yaml", "utf-8")) as Record<string, unknown>;
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
    _prompts = yaml.load(fs.readFileSync("../config/prompts.yaml", "utf-8")) as PromptConfig;
  }
  return _prompts;
}

/** 加载RSS源列表（从 sources.yaml，按tier展平） */
export function loadSources(): Source[] {
  if (!_sources) {
    const raw = yaml.load(fs.readFileSync("../config/sources.yaml", "utf-8")) as Record<string, unknown>;
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