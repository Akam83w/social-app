import { z } from 'zod';
import { isAllowedMediaUrl } from '../../services/media-url';

export const createPostSchema = z
  .object({
    content: z.string().trim().max(5000).optional(),
    mediaUrl: z.string().trim().max(2_000_000).refine(isAllowedMediaUrl, 'INVALID_MEDIA_URL').optional(),
    mediaType: z.literal('image').optional(),
  })
  .refine((data) => Boolean(data.content) || Boolean(data.mediaUrl), { message: 'POST_CONTENT_OR_MEDIA_REQUIRED' });

export type CreatePostInput = z.infer<typeof createPostSchema>;
