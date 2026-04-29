import type { Metadata } from 'next';
import './globals.css';
import { themeBootstrap } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Tellar — Backoffice',
  description: 'Internal operations console. Isolated from the main platform.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
