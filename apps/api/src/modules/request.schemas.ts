import { z } from 'zod';

export const noteSchema = z.object({
  content: z.string().trim().min(1).max(60),
});

export const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const commentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parentCommentId: z.string().uuid().optional(),
});

export const imageUploadSchema = z.object({
  contentType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/i),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  username: z.string().trim().transform((value) => value.replace(/^@/, '')).pipe(z.string().regex(/^[A-Za-z0-9_.]{2,30}$/)),
  phone: z.string().trim().max(20).optional(),
  bio: z.string().trim().max(500).optional(),
});

export const avatarSchema = z.object({
  avatarUrl: z.union([z.string().max(2_000_000), z.null()]),
});

export const callStartSchema = z.object({
  toUserId: z.string().uuid(),
  video: z.boolean().default(false),
});

export const callSignalSchema = z.object({
  toUserId: z.string().uuid(),
  kind: z.string().min(1).max(30),
  payload: z.object({ callId: z.string().uuid() }).passthrough(),
});

export const storyImageSchema = z.object({
  mediaUrl: z.string().url().max(2_000_000),
  mediaType: z.literal('image'),
  content: z.string().trim().max(500).optional(),
});

export const videoUploadSchema = z.object({
  contentType: z.string().regex(/^video\/[A-Za-z0-9.+-]+$/),
  extension: z.string().regex(/^[A-Za-z0-9]{2,5}$/).default('mp4'),
  size: z.number().int().positive().max(100 * 1024 * 1024),
});

export const videoCompleteSchema = z.object({
  objectName: z.string().min(1).max(300),
  content: z.string().trim().max(5000).optional(),
  contentType: z.string().regex(/^video\/[A-Za-z0-9.+-]+$/).optional(),
});

export const reportSchema = z.object({
  targetId: z.string().uuid(),
  targetType: z.enum(['post', 'user']),
  reason: z.string().trim().min(1).max(500),
});

export const moderationAppealSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const performanceSchema = z.object({
  name: z.string().min(1).max(20),
  value: z.number().finite().min(0).max(120_000),
  path: z.string().max(200).optional(),
  connection: z.string().max(20).optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(512),
  }),
}).passthrough();

export const fcmTokenSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
});
