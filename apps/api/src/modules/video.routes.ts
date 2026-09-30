import type { FastifyInstance } from 'fastify';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { posts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '../middleware/auth.middleware';
import { processVideo, uploadOriginalVideo, removeStorageFile } from '../services/video.service';

export async function videoRoutes(app: FastifyInstance) {
  app.post('/posts/video', { preHandler: verifyToken }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const part = await request.file();
    if (!part || !part.mimetype.startsWith('video/')) {
      return reply.status(400).send({ error: 'VIDEO_REQUIRED' });
    }
    const content = getTextFieldValue(part.fields?.content).trim().slice(0, 5000);
    const tempPath = path.join(os.tmpdir(), `sdm-upload-${cryptoRandom()}.video`);
    let backgroundStarted = false;

    try {
      await pipeline(part.file, fs.createWriteStream(tempPath));
      if (part.file.truncated) return reply.status(413).send({ error: 'VIDEO_TOO_LARGE' });

      // Make the uploaded original playable immediately. Heavy transcoding continues in the background.
      const original = await uploadOriginalVideo(tempPath, userId, part.mimetype, getExtension(part.mimetype));
      const [post] = await db.insert(posts).values({
        userId, content: content || null, mediaUrl: original.mediaUrl, mediaType: 'video', mediaPoster: null,
      }).returning();

      backgroundStarted = true;
      void (async () => {
        try {
          const media = await processVideo(tempPath, userId);
          await db.update(posts).set({
            mediaUrl: media.mediaUrl, mediaType: media.mediaType, mediaPoster: media.mediaPoster,
          }).where(eq(posts.id, post.id));
          await removeStorageFile(original.remotePath).catch(() => {});
        } catch (error) {
          app.log.error({ err: error, postId: post.id }, 'background video processing failed');
          // Keep the original uploaded video playable if transcoding fails.
        } finally {
          await fsPromises.rm(tempPath, { force: true }).catch(() => {});
        }
      })();

      return reply.status(201).send({ post });
    } catch (error) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message === 'VIDEO_TOO_LARGE') return reply.status(413).send({ error: message });
      if (message === 'SUPABASE_SERVICE_ROLE_KEY_MISSING') return reply.status(503).send({ error: 'VIDEO_STORAGE_NOT_CONFIGURED' });
      return reply.status(500).send({ error: 'VIDEO_PROCESSING_FAILED' });
    } finally {
      if (!backgroundStarted) await fsPromises.rm(tempPath, { force: true }).catch(() => {});
    }
  });

  app.post('/stories/video', { preHandler: verifyToken }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const part = await request.file();
    if (!part || !part.mimetype.startsWith('video/')) return reply.status(400).send({ error: 'VIDEO_REQUIRED' });
    const content = getTextFieldValue(part.fields?.content).trim().slice(0, 500);
    const tempPath = path.join(os.tmpdir(), `sdm-story-${cryptoRandom()}.video`);
    let backgroundStarted = false;

    try {
      await pipeline(part.file, fs.createWriteStream(tempPath));
      if (part.file.truncated) return reply.status(413).send({ error: 'VIDEO_TOO_LARGE' });

      const original = await uploadOriginalVideo(tempPath, userId, part.mimetype, getExtension(part.mimetype));
      const r = await db.execute(sql`INSERT INTO stories(user_id,media_url,media_type,media_poster,content,expires_at) VALUES(${userId},${original.mediaUrl},'video',NULL,${content || null},now()+interval '24 hours') RETURNING id,media_url,media_type,media_poster,content,created_at,expires_at`);
      const story = r.rows[0];

      backgroundStarted = true;
      void (async () => {
        try {
          const media = await processVideo(tempPath, userId);
          await db.execute(sql`UPDATE stories SET media_url=${media.mediaUrl},media_type='video',media_poster=${media.mediaPoster} WHERE id=${story.id}`);
          await removeStorageFile(original.remotePath).catch(() => {});
        } catch (error) {
          app.log.error({ err: error, storyId: story.id }, 'background story video processing failed');
          // Keep the original uploaded video playable if transcoding fails.
        } finally {
          await fsPromises.rm(tempPath, { force: true }).catch(() => {});
        }
      })();

      return reply.status(201).send({ story });
    } catch (error) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message === 'VIDEO_TOO_LARGE') return reply.status(413).send({ error: message });
      if (message === 'SUPABASE_SERVICE_ROLE_KEY_MISSING') return reply.status(503).send({ error: 'VIDEO_STORAGE_NOT_CONFIGURED' });
      return reply.status(500).send({ error: 'VIDEO_PROCESSING_FAILED' });
    } finally {
      if (!backgroundStarted) await fsPromises.rm(tempPath, { force: true }).catch(() => {});
    }
  });
}

function getTextFieldValue(field: unknown): string {
  if (Array.isArray(field)) {
    const first = field[0];
    return getTextFieldValue(first);
  }
  if (field && typeof field === 'object' && 'value' in field) {
    const value = (field as { value?: unknown }).value;
    return typeof value === 'string' ? value : '';
  }
  return '';
}

function getExtension(mimetype: string) {
  const subtype = mimetype.split('/')[1]?.toLowerCase() || 'mp4';
  return subtype === 'quicktime' ? 'mov' : subtype === 'webm' ? 'webm' : 'mp4';
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}