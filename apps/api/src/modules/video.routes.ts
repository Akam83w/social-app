import type { FastifyInstance } from 'fastify';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { posts } from '../db/schema';
import { verifyToken } from '../middleware/auth.middleware';
import { processVideo } from '../services/video.service';

export async function videoRoutes(app: FastifyInstance) {
  app.post('/posts/video', { preHandler: verifyToken }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const part = await request.file();
    if (!part || !part.mimetype.startsWith('video/')) {
      return reply.status(400).send({ error: 'VIDEO_REQUIRED' });
    }
    const contentField = part.fields?.content;
    const contentValue = Array.isArray(contentField) ? contentField[0]?.value : contentField?.value;
    const content = String(contentValue || '').trim().slice(0, 5000);
    const tempPath = path.join(os.tmpdir(), `sdm-upload-${cryptoRandom()}.video`);
    try {
      await pipeline(part.file, fs.createWriteStream(tempPath));
      if (part.file.truncated) return reply.status(413).send({ error: 'VIDEO_TOO_LARGE' });
      const media = await processVideo(tempPath, userId);
      const [post] = await db.insert(posts).values({
        userId, content: content || null, mediaUrl: media.mediaUrl, mediaType: media.mediaType, mediaPoster: media.mediaPoster,
      }).returning();
      return reply.status(201).send({ post });
    } catch (error) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message === 'VIDEO_TOO_LARGE') return reply.status(413).send({ error: message });
      if (message === 'SUPABASE_SERVICE_ROLE_KEY_MISSING') return reply.status(503).send({ error: 'VIDEO_STORAGE_NOT_CONFIGURED' });
      return reply.status(500).send({ error: 'VIDEO_PROCESSING_FAILED' });
    } finally {
      await fsPromises.rm(tempPath, { force: true }).catch(() => {});
    }
  });
  app.post('/stories/video', { preHandler: verifyToken }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const part = await request.file();
    if (!part || !part.mimetype.startsWith('video/')) return reply.status(400).send({ error: 'VIDEO_REQUIRED' });
    const contentField = part.fields?.content;
    const contentValue = Array.isArray(contentField) ? contentField[0]?.value : contentField?.value;
    const content = String(contentValue || '').trim().slice(0, 500);
    const tempPath = path.join(os.tmpdir(), `sdm-story-${cryptoRandom()}.video`);
    try {
      await pipeline(part.file, fs.createWriteStream(tempPath));
      if (part.file.truncated) return reply.status(413).send({ error: 'VIDEO_TOO_LARGE' });
      const media = await processVideo(tempPath, userId);
      const r = await db.execute(sql`INSERT INTO stories(user_id,media_url,media_type,media_poster,content,expires_at) VALUES(${userId},${media.mediaUrl},'video',${media.mediaPoster},${content || null},now()+interval '24 hours') RETURNING id,media_url,media_type,media_poster,content,created_at,expires_at`);
      return reply.status(201).send({ story: r.rows[0] });
    } catch (error) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message === 'VIDEO_TOO_LARGE') return reply.status(413).send({ error: message });
      if (message === 'SUPABASE_SERVICE_ROLE_KEY_MISSING') return reply.status(503).send({ error: 'VIDEO_STORAGE_NOT_CONFIGURED' });
      return reply.status(500).send({ error: 'VIDEO_PROCESSING_FAILED' });
    } finally {
      await fsPromises.rm(tempPath, { force: true }).catch(() => {});
    }
  });
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}