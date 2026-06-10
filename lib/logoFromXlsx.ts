/** First embedded worksheet image as a data URL (Excel Insert → Picture). */
export function extractEmbeddedLogo(
  files: Record<string, Buffer>
): string | undefined {
  const mediaKeys = Object.keys(files)
    .filter((k) => /^xl\/media\/image\d+\.(png|jpe?g|gif|webp)$/i.test(k))
    .sort((a, b) => {
      const na = parseInt(a.match(/image(\d+)/i)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/image(\d+)/i)?.[1] ?? "0", 10);
      return na - nb;
    });
  if (!mediaKeys.length) return undefined;

  const key = mediaKeys[0];
  const buf = files[key];
  const ext = (key.split(".").pop() ?? "png").toLowerCase();
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "gif"
        ? "image/gif"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function logoUrlFromMeta(meta: Record<string, string>): string | undefined {
  const raw = (meta["Logo"] || meta["โลโก้"] || meta["logo_url"] || "").trim();
  if (!raw) return undefined;
  if (raw.startsWith("data:image/")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return undefined;
}

/** Fetch remote logo on the server so the browser always gets an inline image. */
export async function resolveLogoUrl(
  logoUrl: string | undefined
): Promise<string | undefined> {
  if (!logoUrl) return undefined;
  if (logoUrl.startsWith("data:image/")) return logoUrl;
  if (!/^https?:\/\//i.test(logoUrl)) return undefined;

  try {
    const res = await fetch(logoUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "med-dashboard/1.0" },
    });
    if (!res.ok) return undefined;

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return undefined;

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return undefined;

    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}
