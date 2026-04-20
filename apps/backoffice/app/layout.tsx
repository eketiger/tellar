import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tellar — Backoffice',
  description: 'Internal operations console. Isolated from the main platform.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
