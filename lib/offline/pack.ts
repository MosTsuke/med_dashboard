import type { OfflineFile } from "@/lib/offline/format";

/**
 * How an exported HTML file carries its data: the JSON, gzipped (the
 * browser's own CompressionStream), as base64 text inside
 * <script id="med-offline-data">. Browser-only.
 */

export const DATA_ELEMENT_ID = "med-offline-data";
/** Stands in for the data in the viewer template (public/offline-viewer.html). */
export const DATA_PLACEHOLDER = "__MED_OFFLINE_DATA__";

export async function packOfflineFile(file: OfflineFile): Promise<string> {
  const stream = new Blob([JSON.stringify(file)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

/** The data this page carries, or null when it isn't an exported file. */
export async function unpackOfflineFile(): Promise<OfflineFile | null> {
  const text = document.getElementById(DATA_ELEMENT_ID)?.textContent?.trim();
  if (!text || text === DATA_PLACEHOLDER) return null;
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as OfflineFile;
}
