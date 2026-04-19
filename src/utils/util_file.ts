import fs from "node:fs";

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