/** ตัวเลขแบบไทย — มี comma คั่นหลัก (เช่น 1,494 / 269,415.00) */
export function formatNumber(
  value: number,
  options?: { decimals?: number }
): string {
  if (options?.decimals != null) {
    return value.toLocaleString("th-TH", {
      minimumFractionDigits: options.decimals,
      maximumFractionDigits: options.decimals,
    });
  }
  return value.toLocaleString("th-TH");
}

/** "จำนวนรวม (ชิ้น)" — or just "จำนวนรวม" when the count has no unit
 * (สถิติแพ็ค and Resterile are plain counts). */
export function withUnit(text: string, unit?: string | null): string {
  return unit ? `${text} (${unit})` : text;
}
