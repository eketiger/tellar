import { ToolDefinition } from '../agent/chat-backend';

/**
 * Tool definitions for the conversational tellar authoring agent.
 *
 * The schema is what Claude sees — keep descriptions surgical, the
 * model picks tools based primarily on these. Server-side execution
 * lives in `authoring.service.ts`; the two are kept side-by-side so a
 * tool name change is a one-file rename.
 */
export const AUTHORING_TOOLS: ToolDefinition[] = [
  {
    name: 'list_slides',
    description: 'Return the deck outline (slide idx, title, subtitle, layoutId). Use this before editing to anchor the user\'s intent to a specific slide. Read-only.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_slide',
    description: 'Append a new slide at the end of the deck OR insert at a specific 1-based index by passing `afterIdx`. Returns the new slide id and idx.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Slide title (≤ 80 chars).' },
        subtitle: { type: 'string', description: 'Optional subtitle.' },
        eyebrow: { type: 'string', description: 'Optional kicker text above the title.' },
        notes: { type: 'string', description: 'Optional speaker notes — also fed to the agent KB.' },
        layoutId: { type: 'string', description: 'One of: title, image-bg, image-right, bullets, quote, stat. Default "title".' },
        afterIdx: { type: 'number', description: '1-based idx after which to insert. Omit to append.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_slide',
    description: 'Patch any subset of a slide\'s text fields. Identify by slideIdx (1-based). Will not change idx — use reorder_slides for that.',
    input_schema: {
      type: 'object',
      properties: {
        slideIdx: { type: 'number' },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        eyebrow: { type: 'string' },
        notes: { type: 'string' },
        layoutId: { type: 'string' },
      },
      required: ['slideIdx'],
    },
  },
  {
    name: 'delete_slide',
    description: 'Remove a slide by 1-based idx. Subsequent slides are renumbered automatically.',
    input_schema: {
      type: 'object',
      properties: { slideIdx: { type: 'number' } },
      required: ['slideIdx'],
    },
  },
  {
    name: 'reorder_slides',
    description: 'Apply a new ordering to the entire deck. `order` must be a permutation of every current slideIdx.',
    input_schema: {
      type: 'object',
      properties: {
        order: { type: 'array', items: { type: 'number' }, description: 'Old 1-based idx values, in the new order.' },
      },
      required: ['order'],
    },
  },
];
