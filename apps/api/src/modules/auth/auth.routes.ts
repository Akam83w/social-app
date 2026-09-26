import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from './auth.schema';
import { registerUser, loginUser, updateUserAvatar } from './auth.service';
import { verifyToken } from '../../middleware/auth.middleware';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users, posts, likes, follows } from '../../db/schema';
import { desc, sql, and } from 'drizzle-orm';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    try {
      const user = await registerUser(parsed.data);
      return reply.status(201).send({ user });
    } catch (err: any) {
      if (err.message === 'USER_ALREADY_EXISTS') {
        return reply.status(409).send({ error: 'USER_ALREADY_EXISTS' });
      }
      app.log.error(err);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        debug: {
          message: err instanceof Error ? err.message : String(err),
          name: err instanceof Error ? err.name : typeof err,
          cause: err instanceof Error && err.cause ? String(err.cause) : undefined,
        },
      });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    try {
      const user = await loginUser(parsed.data);
      const token = app.jwt.sign({ id: user.id, username: user.username });
      return reply.status(200).send({ user, token });
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
      }
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });


  app.patch('/auth/avatar', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string; username: string };
    const body = request.body as { avatarUrl?: unknown };

    if (body.avatarUrl !== null && typeof body.avatarUrl !== 'string') {
      return reply.status(400).send({ error: 'INVALID_AVATAR_URL' });
    }

    if (typeof body.avatarUrl === 'string' && body.avatarUrl.length > 2_000_000) {
      return reply.status(413).send({ error: 'AVATAR_TOO_LARGE' });
    }

    try {
      const user = await updateUserAvatar(
        payload.id,
        body.avatarUrl === null ? null : body.avatarUrl || null,
      );

      return reply.status(200).send({ user });
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') {
        return reply.status(404).send({ error: 'USER_NOT_FOUND' });
      }

      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/auth/search/users/:username', { preHandler: verifyToken }, async (request, reply) => {
    const { username } = request.params as { username: string };
    const payload = request.user as { id: string };

    const [profile] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!profile) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    const [relation] = await db
      .select({ id: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followerId, payload.id), eq(follows.followingId, profile.id)))
      .limit(1);

    const [followersRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, profile.id));

    return reply.send({
      user: profile,
      isFollowing: Boolean(relation),
      followerCount: followersRow?.count ?? 0,
    });
  });

  app.post('/auth/users/:username/follow', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string };
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    if (target.id === payload.id) return reply.status(400).send({ error: 'CANNOT_FOLLOW_SELF' });

    await db.insert(follows).values({ followerId: payload.id, followingId: target.id }).onConflictDoNothing();
    return reply.send({ following: true });
  });

  app.delete('/auth/users/:username/follow', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string };
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    await db.delete(follows).where(and(eq(follows.followerId, payload.id), eq(follows.followingId, target.id)));
    return reply.send({ following: false });
  });

  app.get('/auth/users/:username', { preHandler: verifyToken }, async (request, reply) => {
    const { username } = request.params as { username: string };
    const [profile] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    }

    const profilePosts = await db
      .select({
        id: posts.id,
        content: posts.content,
        mediaUrl: posts.mediaUrl,
        mediaType: posts.mediaType,
        createdAt: posts.createdAt,
        likeCount: sql<number>`count(${likes.id})::int`,
      })
      .from(posts)
      .leftJoin(likes, eq(likes.postId, posts.id))
      .where(eq(posts.userId, profile.id))
      .groupBy(posts.id)
      .orderBy(desc(posts.createdAt));

    return reply.status(200).send({
      user: profile,
      posts: profilePosts,
      stats: {
        posts: profilePosts.length,
        followers: 0,
        following: 0,
      },
    });
  });

  app.get('/auth/me', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string; username: string };
    return reply.status(200).send({ user: payload });
  });
}
