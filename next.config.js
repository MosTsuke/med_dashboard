/** @type {import('next').NextConfig} */
const nextConfig = {
  // STANDALONE=1 (set by scripts/package-windows.sh) builds a self-contained
  // server for the hospital's Windows machine. Dev, Vercel and a plain
  // `next build` are unaffected.
  ...(process.env.STANDALONE === "1" ? { output: "standalone" } : {}),
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mssql", "tedious"],
  },
};

module.exports = nextConfig;
