import { defineDocs, defineConfig } from 'fumadocs-mdx/config';

export const docs = defineDocs({ dir: 'content/docs' });
export const help = defineDocs({ dir: 'content/help' });

export default defineConfig();
