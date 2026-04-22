import yaml from "js-yaml";
import type { AppConfig, PromptConfig, Source, EntityConfig } from "../type/types.ts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 项目根目录（基于此文件位置推导）
const PROJECT_ROOT = path.resolve(
  import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url)),
  "..", ".."
);

// ============ 配置加载 ============

let _config: AppConfig | null = null;
let _prompts: PromptConfig | null = null;
let _sources: Source[] | null = null;
let _entities: EntityConfig | null = null;
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
    const configPath = path.resolve(PROJECT_ROOT, "config/config.yaml");
    const raw = yaml.load(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    const llm = raw["llm"] as Record<string, unknown>;
    const collection = raw["collection"] as Record<string, unknown>;
    const concurrency = raw["concurrency"] as Record<string, unknown> | undefined;

    _config = {
      llm: {
        api_key: resolveEnvVar(llm["api_key"] as string),
        base_url: resolveEnvVar(llm["base_url"] as string) || "https://api.openai.com/v1",
        model: resolveEnvVar(llm["model"] as string) || "gpt-4o-mini",
        temperature: (llm["temperature"] as number) ?? 0.3,
        max_tokens: (llm["max_tokens"] as number) ?? 4096,
        daily_budget: (llm["daily_budget"] as number) ?? 200,
      },
      collection: {
        rss_concurrency: (collection["rss_concurrency"] as number) ?? 10,
        content_concurrency: (collection["content_concurrency"] as number) ?? 5,
        max_per_source: (collection["max_per_source"] as number) ?? 200,
        fetch_content: (collection["fetch_content"] as boolean) ?? true,
        content_max_length: (collection["content_max_length"] as number) ?? 20000,
      },
      concurrency: {
        editor_batch_size: (concurrency?.["editor_batch_size"] as number) ?? 20,
        editor_batch: (concurrency?.["editor_batch"] as number) ?? 3,
        writer: (concurrency?.["writer"] as number) ?? 5,
        reviewer: (concurrency?.["reviewer"] as number) ?? 5,
        retry_delay_ms: (concurrency?.["retry_delay_ms"] as number) ?? 1000,
        max_retries: (concurrency?.["max_retries"] as number) ?? 3,
      },
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
    const promptsPath = path.resolve(PROJECT_ROOT, "config/prompts.yaml");
    _prompts = yaml.load(fs.readFileSync(promptsPath, "utf-8")) as PromptConfig;
  }
  return _prompts;
}

/** 加载RSS源列表（从 sources.yaml，按tier展平） */
export function loadSources(): Source[] {
  if (!_sources) {
    const sourcesPath = path.resolve(PROJECT_ROOT, "config/sources.yaml");
    const raw = yaml.load(fs.readFileSync(sourcesPath, "utf-8")) as Record<string, unknown>;
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

/** 加载实体配置（用于标题相似度判断） */
export function loadEntities(): EntityConfig {
  if (!_entities) {
    const entitiesPath = path.resolve(PROJECT_ROOT, "config/entities.yaml");
    try {
      const raw = yaml.load(fs.readFileSync(entitiesPath, "utf-8")) as Record<string, unknown>;
      _entities = {
        aliases: (raw["aliases"] as Record<string, string>) || {},
        products: (raw["products"] as string[]) || [],
        companies: (raw["companies"] as string[]) || [],
        game_series: (raw["game_series"] as string[]) || [],
        hardware: (raw["hardware"] as string[]) || [],
        action_groups: (raw["action_groups"] as Record<string, string[]>) || {},
      };
    } catch {
      // 如果文件不存在，返回空配置
      _entities = {
        aliases: {},
        products: [],
        companies: [],
        game_series: [],
        hardware: [],
        action_groups: {},
      };
    }
  }
  return _entities;
}