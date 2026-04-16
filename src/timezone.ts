/**
 * 时区工具 - 统一使用北京时间 (UTC+8)
 */

import { DateTime } from "luxon";

const ZONE = "Asia/Shanghai";

/** 将任意时间戳转为北京时间 ISO 格式 */
export function toBeijingTime(timestamp: string | Date | number): string {
  let dt: DateTime;

  if (typeof timestamp === "number") {
    dt = timestamp > 1e12
      ? DateTime.fromMillis(timestamp)
      : DateTime.fromSeconds(timestamp);
  } else if (timestamp instanceof Date) {
    dt = DateTime.fromJSDate(timestamp);
  } else {
    dt = DateTime.fromISO(timestamp);
    if (!dt.isValid) dt = DateTime.fromRFC2822(timestamp);
    if (!dt.isValid) dt = DateTime.fromSQL(timestamp);
    if (!dt.isValid) dt = DateTime.now();
  }

  const beijing = dt.setZone(ZONE);
  return beijing.isValid ? (beijing.toISO() ?? "") : "";
}

/** 获取当前北京日期 YYYY-MM-DD */
export function getBeijingDate(): string {
  return DateTime.now().setZone(ZONE).toFormat("yyyy-MM-dd");
}

/** 获取当前北京时间 HH:mm */
export function getBeijingTime(): string {
  return DateTime.now().setZone(ZONE).toFormat("HH:mm");
}

/** 获取完整时间戳字符串 */
export function getBeijingTimestamp(): string {
  return DateTime.now().setZone(ZONE).toFormat("yyyy-MM-dd HH:mm:ss 'UTC+8'");
}

/** 计算时间戳距现在的小时数 */
export function hoursAgo(timestamp: string): number {
  const dt = DateTime.fromISO(timestamp);
  if (!dt.isValid) return 999;
  const now = DateTime.now().setZone(ZONE);
  return Math.abs(now.diff(dt, "hours").hours);
}

/** 获取前N天的日期列表 */
export function getPastDates(days: number): string[] {
  const now = DateTime.now().setZone(ZONE);
  const dates: string[] = [];
  for (let i = 1; i <= days; i++) {
    dates.push(now.minus({ days: i }).toFormat("yyyy-MM-dd"));
  }
  return dates;
}

/** 格式化为年/月路径 */
export function getDateParts(date: string): { year: string; month: string; day: string } {
  const [year, month, day] = date.split("-");
  return { year, month, day };
}
