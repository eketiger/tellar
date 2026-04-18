import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated at build time by fumadocs-mdx
import { docs, help } from '../.source';

export const docsSource = loader({
  baseUrl: '/docs',
  source: createMDXSource(docs),
});

export const helpSource = loader({
  baseUrl: '/help',
  source: createMDXSource(help),
});
