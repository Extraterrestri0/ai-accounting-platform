import type { Config } from 'tailwindcss';

/**
 * Acco design tokens (see app/globals.css for the CSS variables).
 * Components consume semantic tokens only — never raw hex.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        border: { DEFAULT: 'hsl(var(--border))', strong: 'hsl(var(--border-strong))' },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        faint: 'hsl(var(--faint))',
        surface: { DEFAULT: 'hsl(var(--card))', 2: 'hsl(var(--surface-2))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        brand: { DEFAULT: 'hsl(var(--brand))', foreground: 'hsl(var(--brand-foreground))', soft: 'hsl(var(--brand-soft))' },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))', soft: 'hsl(var(--success-soft))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))', soft: 'hsl(var(--warning-soft))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))', soft: 'hsl(var(--destructive-soft))' },
        info: { DEFAULT: 'hsl(var(--info))', soft: 'hsl(var(--info-soft))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        sidebar: { DEFAULT: 'hsl(var(--sidebar))', foreground: 'hsl(var(--sidebar-foreground))', accent: 'hsl(var(--sidebar-accent))', border: 'hsl(var(--sidebar-border))' },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',   /* 14px — large cards / dialogs */
        lg: 'calc(var(--radius) + 2px)',   /* 12px — cards */
        md: 'calc(var(--radius) - 2px)',   /* 8px  — controls */
        sm: 'calc(var(--radius) - 4px)',   /* 6px  — chips */
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'] },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }],
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
        modal: 'var(--shadow-modal)',
        none: 'none',
      },
      maxWidth: { page: '1240px' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: { 'accordion-down': 'accordion-down 0.2s ease-out', 'accordion-up': 'accordion-up 0.2s ease-out' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
