import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/shell/AppShell';

export const metadata: Metadata = { title: 'Счетоводство · AI Accounting (MVP preview)', description: 'Bulgarian-first AI accounting platform — MVP preview' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
