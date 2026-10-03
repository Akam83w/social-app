import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[A-Za-z0-9_.]+$/, 'USERNAME_INVALID_CHARACTERS'),
  email: z.string().email(),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(8),
  passwordConfirmation: z.string().min(8),
  displayName: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  twoFactorCode: z.string().regex(/^\d{6}$/).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
