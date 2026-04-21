/**
 * 并发控制工具 - 限制并行数、重试退让机制
 */

import { loadConfig } from "./util_config.ts";

/**
 * 并发执行任务（限制并行数）
 * @param items 待处理项
 * @param concurrency 最大并发数
 * @param handler 处理函数（可选 index 参数）
 */
export async function parallel<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const errors: Array<{ index: number; error: Error }> = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await handler(items[i], i);
      } catch (err) {
        errors.push({ index: i, error: err as Error });
      }
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);

  if (errors.length > 0) {
    const failed = errors.map(e => `#${e.index}: ${e.error.message}`).join("\n");
    throw new Error(`并行任务失败 ${errors.length}/${items.length}:\n${failed}`);
  }

  return results;
}

/**
 * 带重试退让的执行
 * @param fn 执行函数
 * @param retries 最大重试次数
 * @param delayMs 退让时间
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      // 退让：指数增长
      const wait = delayMs * Math.pow(2, attempt);
      console.log(`  ⚠️ 重试 ${attempt + 1}/${retries}，等待 ${wait}ms...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error(" unreachable");
}

/**
 * 并发执行 + 重试退让
 */
export async function parallelWithRetry<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const cfg = loadConfig();
  return parallel(items, concurrency, (item, index) =>
    withRetry(() => handler(item, index), cfg.concurrency.max_retries, cfg.concurrency.retry_delay_ms)
  );
}