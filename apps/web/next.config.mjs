/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // Client-rendered SaaS app talking to the NestJS API (NEXT_PUBLIC_API_URL).
  // Clean marketing URLs → the generated static pages in public/landing/*.html.
  // App routes (/login, /register, /dashboard, …) are untouched.
  async rewrites() {
    const pages = ['features', 'pricing', 'about', 'faq', 'contact'];
    return {
      beforeFiles: [
        // Bulgarian (default) at the root, English under /en. Same generator, same files.
        { source: '/', destination: '/landing/index.html' },
        ...pages.map((p) => ({ source: `/${p}`, destination: `/landing/${p}.html` })),
        { source: '/en', destination: '/landing/en/index.html' },
        ...pages.map((p) => ({ source: `/en/${p}`, destination: `/landing/en/${p}.html` })),
      ],
    };
  },
};
export default nextConfig;
