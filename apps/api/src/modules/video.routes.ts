import type { FastifyInstance } from 'fastify';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { posts, users } from '../db/schema';
import { verifyToken } from '../middleware/auth.middleware';
import { processVideo } from '../services/video.service';

export async function videoRoutes(app: FastifyInstance) {
  app.post('/posts/video', { preHandler: verifyToken }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const part = await request.file();
    if (!part || !part.mimetype.startsWith('video/')) return reply.status(400).send({ error: 'VIDEO_REQUIRED' });
    const content = getTextFieldValue(part.fields?.content).trim().slice(0, 5000);
    const tempPath = path.join(os.tmpdir(), `sdm-upload-${cryptoRandom()}.video`);
    try {
      await pipeline(part.file, fs.createWriteStream(tempPath));
      if (part.file.truncated) return reply.status(413).send({ error: 'VIDEO_TOO_LARGE' });
      const media = await processVideo(tempPath, userId);
      const [post] = await db.insert(posts).values({ userId, content: content || null, mediaUrl: media.mediaUrl, mediaType: media.mediaType, mediaPoster: media.mediaPoster }).returning();
      return reply.status(201).send({ post });
    } catch (error) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message === 'VIDEO_TOO_LARGE') return reply.status(413).send({ error: message });
      if (message === 'SUPABASE_SERVICE_ROLE_KEY_MISSING') return reply.status(503).send({ error: 'VIDEO_STORAGE_NOT_CONFIGURED' });
      return reply.status(500).send({ error: 'VIDEO_PROCESSING_FAILED' });
    } finally { await fsPromises.rm(tempPath, { force: true }).catch(() => {}); }
  });

  app.get('/reels', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = (request.user as { id: string }).id;
      const query = request.query as { limit?: string; cursor?: string };
      const requestedLimit = Number(query.limit || 10);
      const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), 20);
      const cursorParts = query.cursor?.split('__') ?? [];
      const cursorDate = cursorParts[0] ? new Date(cursorParts[0]) : null;
      const cursorId = cursorParts[1] || null;
      const cursorCondition = cursorDate && !Number.isNaN(cursorDate.getTime())
        ? cursorId ? sql`(${posts.createdAt} < ${cursorDate} OR (${posts.createdAt} = ${cursorDate} AND ${posts.id} < ${cursorId}))` : sql`${posts.createdAt} < ${cursorDate}`
        : sql`true`;
      const rows = await db.select({
        id: posts.id, content: posts.content, mediaUrl: posts.mediaUrl, mediaType: posts.mediaType, mediaPoster: posts.mediaPoster,
        createdAt: posts.createdAt, updatedAt: posts.updatedAt,
        user: { id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, supporterNumber: users.supporterNumber, supporterExpiresAt: users.supporterExpiresAt, verifiedAt: users.verifiedAt },
        likeCount: sql<number>`(SELECT count(*)::int FROM likes WHERE likes.post_id = ${posts.id})`,
        likedByMe: sql<boolean>`EXISTS (SELECT 1 FROM likes WHERE likes.post_id = ${posts.id} AND likes.user_id = ${userId})`,
      }).from(posts).innerJoin(users, sql`${posts.userId} = ${users.id}`)
        .where(sql`${cursorCondition} AND ${posts.mediaType} = 'video' AND (${users.isPrivate} = false OR ${users.id} = ${userId} OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=${userId} AND f.following_id=${users.id} AND f.status='accepted')) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${userId} AND b.blocked_id=${posts.userId}) OR (b.blocker_id=${posts.userId} AND b.blocked_id=${userId}))`)
        .orderBy(sql`${posts.createdAt} DESC`, sql`${posts.id} DESC`).limit(limit);
      const last = rows[rows.length - 1];
      return reply.send({ reels: rows, nextCursor: rows.length === limit && last ? `${last.createdAt}__${last.id}` : null });
    } catch (error) { app.log.error(error); return reply.status(500).send({ error: 'INTERNAL_ERROR' }); }
  });

  app.post('/stories/video', { preHandler: verifyToken }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const part = await request.file();
    if (!part || !part.mimetype.startsWith('video/')) return reply.status(400).send({ error: 'VIDEO_REQUIRED' });
    const content = getTextFieldValue(part.fields?.content).trim().slice(0, 500);
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
    } finally { await fsPromises.rm(tempPath, { force: true }).catch(() => {}); }
  });
}

function getTextFieldValue(field: unknown): string {
  if (Array.isArray(field)) return getTextFieldValue(field[0]);
  if (field && typeof field === 'object' && 'value' in field) { const value = (field as { value?: unknown }).value; return typeof value === 'string' ? value : ''; }
  return '';
}
function cryptoRandom() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }