/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // Client-rendered SaaS app talking to the NestJS API (NEXT_PUBLIC_API_URL).
  // Clean marketing URLs → the generated static pages in public/landing/*.html.
  // App routes (/login, /register, /dashboard, …) are untouched.
  async rewrites() {
    const pages = ['features', 'pricing', 'about', 'blog', 'resources', 'faq', 'contact'];
    return {
      beforeFiles: [
        { source: '/', destination: '/landing/index.html' },
        { source: '/admin', destination: '/landing/admin.html' },
        ...pages.map((p) => ({ source: `/${p}`, destination: `/landing/${p}.html` })),
      ],
    };
  },
};
export default nextConfig;
