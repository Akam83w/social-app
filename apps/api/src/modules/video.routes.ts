import type { FastifyInstance } from 'fastify';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { posts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '../middleware/auth.middleware';
import { createDirectVideoUpload, getPublicVideoUrl, downloadVideoToFile, processVideo, removeStorageFile } from '../services/video.service';
import { videoUploadSchema, videoCompleteSchema } from './request.schemas';

export async function videoRoutes(app: FastifyInstance) {
  app.post('/posts/video/upload', { preHandler: verifyToken }, async (request, reply) => {
    return prepareVideoUpload(request, reply);
  });

  app.post('/stories/video/upload', { preHandler: verifyToken }, async (request, reply) => {
    return prepareVideoUpload(request, reply);
  });

  app.post('/posts/video/complete', { preHandler: verifyToken }, async (request, reply) => {
    return completePostVideo(request, reply, app);
  });

  app.post('/stories/video/complete', { preHandler: verifyToken }, async (request, reply) => {
    return completeStoryVideo(request, reply, app);
  });
}

async function prepareVideoUpload(request: any, reply: any) {
  const userId = request.user.id as string;
  const parsed = videoUploadSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: 'INVALID_VIDEO_UPLOAD', details: parsed.error.flatten() });
  const body = parsed.data;
  const contentType = body.contentType;
  const size = body.size;

  try {
    return reply.send(await createDirectVideoUpload(userId, contentType, body?.extension || 'mp4', size));
  } catch (error) {
    request.log.error(error);
    const message = error instanceof Error ? error.message : '';
    if (message === 'SUPABASE_SERVICE_ROLE_KEY_MISSING') return reply.status(503).send({ error: 'VIDEO_STORAGE_NOT_CONFIGURED' });
    return reply.status(500).send({ error: 'VIDEO_UPLOAD_INIT_FAILED' });
  }
}

async function completePostVideo(request: any, reply: any, app: FastifyInstance) {
  const userId = request.user.id as string;
  const parsed = videoCompleteSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: 'INVALID_VIDEO_COMPLETE', details: parsed.error.flatten() });
  const body = parsed.data;
  const objectName = body.objectName;
  if (!isOwnedOriginal(objectName, userId)) return reply.status(400).send({ error: 'VIDEO_UPLOAD_INVALID' });

  try {
    const mediaUrl = getPublicVideoUrl(objectName);
    const [post] = await db.insert(posts).values({
      userId,
      content: String(body.content || '').trim().slice(0, 5000) || null,
      mediaUrl,
      mediaType: 'video',
      mediaPoster: null,
    }).returning();

    void processUploadedVideoInBackground(app, objectName, userId, 'post', post.id);
    return reply.status(201).send({ post });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'VIDEO_PROCESSING_FAILED' });
  }
}

async function completeStoryVideo(request: any, reply: any, app: FastifyInstance) {
  const userId = request.user.id as string;
  const parsed = videoCompleteSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: 'INVALID_VIDEO_COMPLETE', details: parsed.error.flatten() });
  const body = parsed.data;
  const objectName = body.objectName;
  if (!isOwnedOriginal(objectName, userId)) return reply.status(400).send({ error: 'VIDEO_UPLOAD_INVALID' });

  try {
    const mediaUrl = getPublicVideoUrl(objectName);
    const r = await db.execute(sql`INSERT INTO stories(user_id,media_url,media_type,media_poster,content,expires_at) VALUES(${userId},${mediaUrl},'video',NULL,${String(body.content || '').trim().slice(0, 500) || null},now()+interval '24 hours') RETURNING id,media_url,media_type,media_poster,content,created_at,expires_at`);
    const story = r.rows[0];

    void processUploadedVideoInBackground(app, objectName, userId, 'story', String(story.id));
    return reply.status(201).send({ story });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'VIDEO_PROCESSING_FAILED' });
  }
}

function isOwnedOriginal(objectName: string, userId: string) {
  return objectName.startsWith(`videos/${userId}/originals/`) &&
    objectName.length < 300 &&
    !objectName.includes('..') &&
    /\.(mp4|mov|webm)$/i.test(objectName);
}

async function processUploadedVideoInBackground(
  app: FastifyInstance,
  objectName: string,
  userId: string,
  kind: 'post' | 'story',
  recordId: string,
) {
  const tempPath = path.join(os.tmpdir(), `sdm-direct-${Date.now()}-${Math.random().toString(36).slice(2)}.video`);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await downloadVideoToFile(objectName, tempPath);
      const media = await processVideo(tempPath, userId);

      if (kind === 'post') {
        await db.update(posts).set({
          mediaUrl: media.mediaUrl,
          mediaType: media.mediaType,
          mediaPoster: media.mediaPoster,
        }).where(eq(posts.id, recordId));
      } else {
        await db.execute(sql`UPDATE stories SET media_url=${media.mediaUrl},media_type='video',media_poster=${media.mediaPoster} WHERE id=${recordId}`);
      }

      await removeStorageFile(objectName).catch(() => {});
      try {
        await (app as any).notifyUser(
          userId,
          'video_ready',
          kind === 'post' ? 'الفيديو صار جاهز' : 'القصة صارت جاهزة',
          kind === 'post' ? 'تمت معالجة الفيديو وصار جاهز للمشاهدة بجودات مناسبة.' : 'تمت معالجة فيديو القصة وصار جاهز للمشاهدة.',
          userId,
          { recordId, kind, url: kind === 'post' ? '/post/' + recordId : '/stories' },
        );
      } catch {}
      return;
    } catch (error) {
      lastError = error;
      app.log.error({ err: error, objectName, recordId, attempt }, 'background direct video processing attempt failed');
      await fsPromises.rm(tempPath, { force: true }).catch(() => {});
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }

  app.log.error({ err: lastError, objectName, recordId }, 'background direct video processing failed permanently');
  try {
    await (app as any).notifyUser(
      userId,
      'video_processing_failed',
      'تعذرت معالجة الفيديو',
      'الفيديو انرفع، لكن تعذرت معالجته حالياً. حاول فتح المنشور لاحقاً.',
      userId,
      { recordId, kind, url: kind === 'post' ? '/post/' + recordId : '/stories' },
    );
  } catch {}

  // Keep the original upload when processing fails so the published item
  // remains playable instead of pointing at a deleted object.
  await fsPromises.rm(tempPath, { force: true }).catch(() => {});
}
