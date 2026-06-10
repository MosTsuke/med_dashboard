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
