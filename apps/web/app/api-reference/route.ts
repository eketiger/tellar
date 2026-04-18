import { ApiReference } from '@scalar/nextjs-api-reference';

export const GET = ApiReference({
  spec: { url: '/openapi.yaml' },
  theme: 'default',
  layout: 'modern',
  darkMode: true,
  metaData: {
    title: 'Tellar — API Reference',
    description: 'Interactive reference for the Tellar REST API.',
  },
  authentication: { preferredSecurityScheme: 'bearerAuth' },
});
