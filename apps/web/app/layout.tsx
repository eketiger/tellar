import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono, Inter_Tight } from 'next/font/google';
import './globals.css';
import { CookieBanner } from '@/components/CookieBanner';
import { themeBootstrap } from '@/components/ThemeToggle';

// next/font self-hosts these from Google Fonts at build time, ships
// preload tags + woff2, and exposes them as CSS variables so globals.css
// can keep its current --serif / --mono / --sans tokens.
const serif = Fraunces({ subsets: ['latin'], variable: '--tellar-font-serif', display: 'swap', weight: ['300', '400', '500', '600'], style: ['normal', 'italic'] });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--tellar-font-mono', display: 'swap', weight: ['300', '400', '500', '600'] });
const sans = Inter_Tight({ subsets: ['latin'], variable: '--tellar-font-sans', display: 'swap', weight: ['300', '400', '500', '600'] });

export const metadata: Metadata = {
  title: 'Tellar — Presentations that know when they lose you.',
  description:
    'DocSend × Loom × AI agents. Share decks that track funnel drop-off, record narration, and answer viewer questions from your knowledge base.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable} ${sans.variable}`}>
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
