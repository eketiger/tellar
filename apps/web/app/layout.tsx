import type { Metadata } from 'next';
import './globals.css';
import { CookieBanner } from '@/components/CookieBanner';
import { themeBootstrap } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Tellar — Presentations that know when they lose you.',
  description:
    'DocSend × Loom × AI agents. Share decks that track funnel drop-off, record narration, and answer viewer questions from your knowledge base.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Sets data-theme before paint so light/dark never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
