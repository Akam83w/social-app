import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { verifyToken } from '../../middleware/auth.middleware';
import { moderateMedia, registerModerationViolation } from '../../services/moderation.service';
import { createPostSchema } from './posts.schema';
import { createDirectImageUpload } from '../../services/image.service';
import {
  getPostLikeStatus,
  createPost,
  getPostById,
  getPosts,
  getPostsByHashtag,
  getExplorePosts,
  getPostComments,
  getCommentById,
  createComment,
  deleteComment,
  likePost,
  unlikePost,
  deletePost,
} from './posts.service';

async function ensurePostAccessible(userId: string, postId: string) {
  const row = await db.execute(sql`SELECT 1 FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=${postId} AND (u.id=${userId} OR (u.is_private=false OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=${userId} AND f.following_id=u.id AND f.status='accepted'))) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${userId} AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=${userId})) LIMIT 1`);
  return Boolean(row.rows[0]);
}

export async function postsRoutes(app: FastifyInstance) {
  app.post('/posts/image/upload', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const body = request.body as { contentType?: string; size?: number };
      const upload = await createDirectImageUpload(
        payload.id,
        String(body.contentType || ''),
        Number(body.size || 0),
      );
      return reply.status(200).send(upload);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'IMAGE_UPLOAD_URL_FAILED';
      if (code === 'IMAGE_TOO_LARGE') return reply.status(413).send({ error: code });
      if (code === 'INVALID_IMAGE_TYPE') return reply.status(415).send({ error: code });
      if (code === 'SUPABASE_SERVICE_ROLE_KEY_MISSING') {
        return reply.status(503).send({ error: 'IMAGE_STORAGE_NOT_CONFIGURED' });
      }
      app.log.error(err);
      return reply.status(500).send({ error: 'IMAGE_UPLOAD_URL_FAILED' });
    }
  });

  app.post('/posts', { preHandler: verifyToken }, async (request, reply) => {
    const parsed = createPostSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    try {
      const payload = request.user as { id: string };

      if (parsed.data.mediaUrl && parsed.data.mediaType) {
        let decision;
        try {
          decision = await moderateMedia(parsed.data.mediaUrl, parsed.data.mediaType);
        } catch (moderationError) {
          const code = moderationError instanceof Error ? moderationError.message : 'MODERATION_ERROR';
          if (code === 'MODERATION_VIDEO_NOT_SUPPORTED') return reply.status(503).send({ error: 'MEDIA_REVIEW_REQUIRED' });
          return reply.status(503).send({ error: 'MODERATION_UNAVAILABLE' });
        }
        if (decision.flagged) {
          const enforcement = await registerModerationViolation(payload.id, 'post', null, decision);
          try { await (app as any).notifyUser(payload.id, 'moderation', 'تم رفض المنشور', enforcement.action === 'warning' ? 'تم رفض المحتوى لأنه يخالف إرشادات SDM.' : 'تم رفض المحتوى وتم تطبيق إجراء على الحساب بسبب تكرار المخالفات.', payload.id, { url: '/profile/settings' }); } catch {}
          return reply.status(422).send({ error: 'CONTENT_REJECTED', action: enforcement.action, strikes: enforcement.strikes });
        }
      }

      const post = await createPost(payload.id, parsed.data);
      const followers = await db.execute(sql`SELECT follower_id FROM follows WHERE following_id=${payload.id} AND status='accepted'`);
      const actor = await db.execute(sql`SELECT username,display_name FROM users WHERE id=${payload.id} LIMIT 1`);
      const a:any=actor.rows[0]; for(const row of followers.rows as any[]) await (app as any).notifyUser(row.follower_id,'post','منشور جديد',`@${a?.username||"مستخدم"} نشر منشوراً جديداً`,payload.id,{actorId:payload.id,url:'/post/'+post.id});
      return reply.status(201).send({ post });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const query = request.query as { limit?: string; cursor?: string };
      const limit = Number(query.limit || 20);
      const result = await getPosts(payload.id, limit, query.cursor);

      return reply.status(200).send({
        posts: result,
        nextCursor: result.length === Math.min(Math.max(limit, 1), 50)
          ? (result[result.length - 1] ? `${result[result.length - 1].createdAt}__${result[result.length - 1].id}` : null)
          : null,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts/explore', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const query = request.query as { limit?: string; cursor?: string };
      const limit = Number(query.limit || 30);
      const result = await getExplorePosts(payload.id, limit, query.cursor);
      const safeLimit = Math.min(Math.max(limit, 1), 50);
      return reply.send({
        posts: result,
        nextCursor: result.length === safeLimit && result[result.length - 1]
          ? `${result[result.length - 1].createdAt}__${result[result.length - 1].id}`
          : null,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts/hashtag/:tag', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const { tag } = request.params as { tag: string };
      const payload = request.user as { id: string };
      const result = await getPostsByHashtag(payload.id, decodeURIComponent(tag), 50);
      return reply.status(200).send({ posts: result });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts/:id/like', { preHandler: verifyToken }, async (request, reply) => {
    const user = request.user as { id: string };
    const { id } = request.params as { id: string };

    if (!(await ensurePostAccessible(user.id, id))) return reply.status(404).send({ error: 'POST_NOT_FOUND' });
    const result = await getPostLikeStatus(user.id, id);

    return reply.send(result);
  });

  app.post('/posts/:id/like', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };

      if (!(await ensurePostAccessible(payload.id, id))) return reply.status(404).send({ error: 'POST_NOT_FOUND' });
      await likePost(payload.id, id);
      const owner=await db.execute(sql`SELECT p.user_id,u.username FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=${id} LIMIT 1`); const o:any=owner.rows[0]; if(o?.user_id&&o.user_id!==payload.id){const actor=await db.execute(sql`SELECT username FROM users WHERE id=${payload.id} LIMIT 1`);const a:any=actor.rows[0];await (app as any).notifyUser(o.user_id,'like','إعجاب جديد',`@${a?.username||"مستخدم"} أعجب بمنشورك`,payload.id,{actorId:payload.id,url:'/post/'+id});}

      return reply.status(200).send({
        liked: true,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.delete('/posts/:id', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };
      const deleted = await deletePost(payload.id, id);
      if (!deleted) return reply.status(404).send({ error: 'POST_NOT_FOUND' });
      return reply.status(200).send({ deleted: true });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.delete('/posts/:id/like', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };

      if (!(await ensurePostAccessible(payload.id, id))) return reply.status(404).send({ error: 'POST_NOT_FOUND' });
      await unlikePost(payload.id, id);

      return reply.status(200).send({
        liked: false,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts/:id/comments', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const payload = request.user as { id: string };
      const privateDenied = await db.execute(sql`SELECT 1 FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=${id} AND u.is_private=true AND u.id<>${payload.id} AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=${payload.id} AND f.following_id=u.id AND f.status='accepted') LIMIT 1`);
      if (privateDenied.rows[0]) return reply.status(404).send({ error: 'POST_NOT_FOUND' });
      const result = await getPostComments(id, payload.id);

      return reply.status(200).send({
        comments: result,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.post('/posts/:id/comments', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };
      if (!(await ensurePostAccessible(payload.id, id))) return reply.status(404).send({ error: 'POST_NOT_FOUND' });
      const body = request.body as {
        content?: string;
        parentCommentId?: string;
      };

      const content = body.content?.trim();

      if (!content) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
        });
      }

      if (body.parentCommentId) {
        const parentComment = await getCommentById(body.parentCommentId);

        if (!parentComment || parentComment.postId !== id) {
          return reply.status(400).send({
            error: 'INVALID_PARENT_COMMENT',
          });
        }
      }

      const comment = await createComment(
        payload.id,
        id,
        content,
        body.parentCommentId,
      );

      // Notify real users mentioned in the comment (@username), without duplicating notifications.
      const mentions = [...new Set(
        (content.match(/@[A-Za-z0-9_.-]{2,50}/g) ?? [])
          .map((value) => value.slice(1).toLowerCase()),
      )];

      if (mentions.length) {
        const mentionedUsers = await db.execute(sql`
          SELECT id, username
          FROM users
          WHERE lower(username) IN (${sql.join(mentions.map((username) => sql`${username}`), sql`, `)} )
          LIMIT 20
        `);
        const actor = await db.execute(sql`SELECT username FROM users WHERE id=${payload.id} LIMIT 1`);
        const actorUsername = String((actor.rows[0] as any)?.username || 'مستخدم');

        for (const row of mentionedUsers.rows as any[]) {
          if (String(row.id) === payload.id) continue;
          try {
            await (app as any).notifyUser(
              String(row.id),
              'mention',
              'منشن جديد',
              `@${actorUsername} ذكرك في تعليق`,
              payload.id,
              { actorId: payload.id, url: '/post/' + encodeURIComponent(id) },
            );
          } catch {}
        }
      }

      return reply.status(201).send({
        comment,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.delete('/comments/:id', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };

      const deleted = await deleteComment(payload.id, id);

      if (!deleted) {
        return reply.status(404).send({
          error: 'COMMENT_NOT_FOUND',
        });
      }

      return reply.status(200).send({
        deleted: true,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.post('/reports', { preHandler: verifyToken }, async (request, reply) => {
    const reporterId = (request.user as { id: string }).id;
    const body = request.body as { targetId?: string; targetType?: string; reason?: string };
    const targetId = String(body.targetId || '').trim();
    const targetType = String(body.targetType || '').trim().toLowerCase();
    const reason = String(body.reason || '').trim().slice(0, 500);
    if (!targetId || !['post', 'user'].includes(targetType) || !reason) {
      return reply.status(400).send({ error: 'INVALID_REPORT' });
    }
    if (targetType === 'post') {
      const found = await db.execute(sql`SELECT id FROM posts WHERE id=${targetId} LIMIT 1`);
      if (!found.rows[0]) return reply.status(404).send({ error: 'TARGET_NOT_FOUND' });
    } else {
      const found = await db.execute(sql`SELECT id FROM users WHERE id=${targetId} LIMIT 1`);
      if (!found.rows[0]) return reply.status(404).send({ error: 'TARGET_NOT_FOUND' });
    }
    if (targetType === 'user' && targetId === reporterId) {
      return reply.status(400).send({ error: 'CANNOT_REPORT_SELF' });
    }
    await db.execute(sql`INSERT INTO reports(reporter_id,target_id,target_type,reason) VALUES(${reporterId},${targetId},${targetType},${reason})`);
    return reply.status(201).send({ reported: true });
  });

  app.get('/posts/:id', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const me = (request.user as { id: string }).id;
    const blocked = await db.execute(sql`SELECT 1 FROM blocks WHERE (blocker_id=${me} AND blocked_id=(SELECT user_id FROM posts WHERE id=${id})) OR (blocked_id=${me} AND blocker_id=(SELECT user_id FROM posts WHERE id=${id})) LIMIT 1`);
    const privateDenied = await db.execute(sql`SELECT 1 FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=${id} AND u.is_private=true AND u.id<>${me} AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=${me} AND f.following_id=u.id AND f.status='accepted') LIMIT 1`);
    if (privateDenied.rows[0]) return reply.status(404).send({ error: 'POST_NOT_FOUND' });

    if (blocked.rows[0]) return reply.status(404).send({ error: 'POST_NOT_FOUND' });

    const post = await getPostById(id);

    if (!post) {
      return reply.status(404).send({
        error: 'POST_NOT_FOUND',
      });
    }

    return reply.status(200).send({ post });
  });
}
