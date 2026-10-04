import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Acco', template: '%s · Acco' },
  description: 'Acco — AI счетоводство за български фирми: качване, извличане, човешки преглед, осчетоводяване, ДДС и отчети.',
  icons: { icon: '/landing/assets/app-icon.svg' },
};

/* Set the theme class on <html> before paint to avoid a flash and any hydration
   mismatch: read the saved choice, else fall back to the OS preference. */
const themeInit = `(function(){try{var t=localStorage.getItem('acco-theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark')document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=(t==='dark'?'dark':'light');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
