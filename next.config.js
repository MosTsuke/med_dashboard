/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mssql", "tedious"],
  },
};

module.exports = nextConfig;
