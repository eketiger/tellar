import 'fumadocs-ui/style.css';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { helpSource } from '@/lib/docs-source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={helpSource.pageTree}
      nav={{ title: 'Tellar · Help', transparentMode: 'top' }}
      sidebar={{ collapsible: true, defaultOpenLevel: 1 }}
    >
      {children}
    </DocsLayout>
  );
}
