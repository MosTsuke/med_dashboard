/**
 * The hospital's own name and logo, shown instead of "Med Dashboard"
 * (header, browser tab, footer, exported HTML files). Shared by the server
 * (lib/branding.ts) and the browser.
 */
export interface BrandingInfo {
  /** null = not set: the page says "Med Dashboard". */
  hospitalName: string | null;
  /** URL of the logo (a data: URL inside an exported file); null = none. */
  logoUrl: string | null;
  /** Whether this server lets them be changed from the page. */
  editable: boolean;
  /** Why not, when it doesn't (Thai, for the edit dialog). */
  reason?: string;
}

/** Longest hospital name accepted. */
export const MAX_HOSPITAL_NAME = 120;
/** Largest logo accepted, in bytes. */
export const MAX_LOGO_BYTES = 1024 * 1024;
/** Logo types accepted — pictures only (no SVG: it can carry scripts). */
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];

export const DEFAULT_TITLE = "Med Dashboard";
