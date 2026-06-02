/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // static export — deploys to Netlify/Vercel as static, runs locally
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },  // lint runs via `npm run lint` (eslint-config-next) — not in the static build
  // The preview ships UI only; representative screens use a mock data layer (no backend needed).
};
export default nextConfig;
