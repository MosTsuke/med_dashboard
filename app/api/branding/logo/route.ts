import { readLogo } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/branding/logo → the hospital's logo picture (404 when none). */
export async function GET() {
  const logo = await readLogo();
  if (!logo) return new Response("ไม่มีโลโก้", { status: 404 });
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.type,
      "X-Content-Type-Options": "nosniff",
      // The URL changes (?v=) whenever the logo does.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
