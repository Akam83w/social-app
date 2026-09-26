import { z } from 'zod';

export const createPostSchema = z
  .object({
    content: z.string().trim().max(5000).optional(),
    mediaUrl: z.string().trim().max(2_000_000).optional(),
    mediaType: z.enum(['image', 'video']).optional(),
  })
  .refine(
    (data) => Boolean(data.content) || Boolean(data.mediaUrl),
    {
      message: 'POST_CONTENT_OR_MEDIA_REQUIRED',
    }
  );

export type CreatePostInput = z.infer<typeof createPostSchema>;
