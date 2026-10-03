import { z } from 'zod';

const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[A-Za-z0-9_.]+$/, 'USERNAME_INVALID_CHARACTERS'),
  email: z.string().email().max(255),
  phone: z.string().min(8).max(20).optional(),
  password: passwordSchema,
  passwordConfirmation: passwordSchema,
  displayName: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(1).max(255),
  password: z.string().min(1).max(128),
});

export const oauthExchangeSchema = z.object({
  accessToken: z.string().min(1).max(4096),
  provider: z.enum(['facebook', 'twitter']),
  username: z.string().min(2).max(30).optional(),
  phone: z.string().min(8).max(20).optional(),
});

export const oauthLinkSchema = z.object({
  accessToken: z.string().min(1).max(4096),
  provider: z.enum(['facebook', 'twitter']),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const authSettingsSchema = z.object({
  allowMessages: z.enum(['everyone', 'followers', 'nobody']).optional(),
  notifyLikes: z.boolean().optional(),
  notifyFollowers: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
});

export const privacySchema = z.object({
  isPrivate: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
