import fs from "node:fs";
import path from "node:path";

// 项目根目录（基于此文件位置推导）
const PROJECT_ROOT = path.resolve(import.meta.dirname, "..", "..");

/** 确保目录存在并保存 JSON（路径相对于项目根目录） */
export function saveJson(filepath: string, data: unknown): void {
  const fullPath = path.resolve(PROJECT_ROOT, filepath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf-8");
}

/** 读取 JSON 文件（路径相对于项目根目录，不存在返回 null） */
export function readJson<T>(filepath: string): T | null {
  const fullPath = path.resolve(PROJECT_ROOT, filepath);
  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}