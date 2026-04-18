import type { Metadata } from 'next';
import './globals.css';
import { CookieBanner } from '@/components/CookieBanner';

export const metadata: Metadata = {
  title: 'Tellar — Presentations that know when they lose you.',
  description:
    'DocSend × Loom × AI agents. Share decks that track funnel drop-off, record narration, and answer viewer questions from your knowledge base.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
