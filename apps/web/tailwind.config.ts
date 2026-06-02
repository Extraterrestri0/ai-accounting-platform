import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a', muted: '#64748b', line: '#e2e8f0',
        brand: { DEFAULT: '#0b6b5e', soft: '#e6f4f1' },
        ok: '#15803d', warn: '#b45309', info: '#1d4ed8', danger: '#b91c1c',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['ui-monospace', 'SFMono-Regular', 'monospace'] },
    },
  },
  plugins: [],
};
export default config;
