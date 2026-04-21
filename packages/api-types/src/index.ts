import { z } from 'zod';

export const Role = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);
export const Plan = z.enum(['FREE', 'PRO', 'SCALE', 'ENTERPRISE']);
export const AccessMode = z.enum(['PUBLIC', 'EMAIL_GATED', 'PASSPHRASE', 'INVITE_ONLY']);
export const EventType = z.enum([
  'SLIDE_VIEW',
  'SLIDE_DWELL',
  'AGENT_QUERY',
  'SHARE_OPEN',
  'DOWNLOAD',
]);

export const RegisterDto = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(120),
});
export type RegisterDto = z.infer<typeof RegisterDto>;

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginDto>;

export const CreateTellerDto = z.object({
  title: z.string().min(1).max(160),
  theme: z.string().optional(),
});
export type CreateTellerDto = z.infer<typeof CreateTellerDto>;

export const UpdateTellerDto = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
  deletedAt: z.string().datetime().nullable().optional(),
});
export type UpdateTellerDto = z.infer<typeof UpdateTellerDto>;

export const UpdateSlideDto = z.object({
  eyebrow: z.string().nullable().optional(),
  title: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  layoutId: z.string().optional(),
  background: z.record(z.any()).nullable().optional(),
  layout: z.record(z.any()).optional(),
  idx: z.number().int().optional(),
});
export type UpdateSlideDto = z.infer<typeof UpdateSlideDto>;

export const SharePermsDto = z.object({
  agent: z.boolean().default(true),
  recording: z.boolean().default(true),
  download: z.boolean().default(false),
  reshare: z.boolean().default(false),
  nda: z.boolean().default(false),
  watermark: z.boolean().default(true),
  blockScreenRec: z.boolean().default(false),
});
export type SharePermsDto = z.infer<typeof SharePermsDto>;

export const CreateShareDto = z.object({
  accessMode: AccessMode.default('EMAIL_GATED'),
  allowedDomains: z.array(z.string()).default([]),
  passphrase: z.string().optional(),
  perms: SharePermsDto.partial().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxOpens: z.number().int().nullable().optional(),
  requireOTC: z.boolean().optional(),
});
export type CreateShareDto = z.infer<typeof CreateShareDto>;

export const UpdateShareDto = CreateShareDto.partial();
export type UpdateShareDto = z.infer<typeof UpdateShareDto>;

export const AuthorizeViewerDto = z.object({
  email: z.string().email().optional(),
  passphrase: z.string().optional(),
});
export type AuthorizeViewerDto = z.infer<typeof AuthorizeViewerDto>;

export const AgentAskDto = z.object({
  tellerId: z.string(),
  question: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .default([]),
  email: z.string().email().optional(),
});
export type AgentAskDto = z.infer<typeof AgentAskDto>;

export const TrackEventDto = z.object({
  type: EventType,
  tellerId: z.string(),
  shareId: z.string().optional(),
  sessionId: z.string(),
  email: z.string().email().optional(),
  slideIdx: z.number().int().optional(),
  dwellMs: z.number().int().optional(),
  meta: z.record(z.any()).optional(),
});
export type TrackEventDto = z.infer<typeof TrackEventDto>;

export const InviteMemberDto = z.object({
  email: z.string().email(),
  role: Role.default('EDITOR'),
});
export type InviteMemberDto = z.infer<typeof InviteMemberDto>;
