import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono, Inter_Tight } from 'next/font/google';
import './globals.css';
import { themeBootstrap } from '@/components/ThemeToggle';

const serif = Fraunces({ subsets: ['latin'], variable: '--tellar-font-serif', display: 'swap', weight: ['300', '400', '500', '600'], style: ['normal', 'italic'] });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--tellar-font-mono', display: 'swap', weight: ['300', '400', '500', '600'] });
const sans = Inter_Tight({ subsets: ['latin'], variable: '--tellar-font-sans', display: 'swap', weight: ['300', '400', '500', '600'] });

export const metadata: Metadata = {
  title: 'Tellar — Backoffice',
  description: 'Internal operations console. Isolated from the main platform.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
