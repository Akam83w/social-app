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
      if (err?.code === '23505' && String(err?.constraint || '').includes('username')) {
        return reply.status(409).send({ error: 'USERNAME_TAKEN' });
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


  app.patch('/auth/privacy', { preHandler: verifyToken }, async (request, reply) => {
    const me = (request.user as { id: string }).id;
    const body = request.body as { isPrivate?: unknown };
    if (typeof body.isPrivate !== 'boolean') return reply.status(400).send({ error: 'INVALID_PRIVACY' });
    const [updated] = await db.update(users).set({ isPrivate: body.isPrivate, updatedAt: new Date() }).where(eq(users.id, me)).returning({
      id: users.id, username: users.username, email: users.email, phone: users.phone, displayName: users.displayName,
      bio: users.bio, avatarUrl: users.avatarUrl, isPrivate: users.isPrivate,
    });
    if (!updated) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    if (!body.isPrivate) await db.update(follows).set({ status: 'accepted' }).where(and(eq(follows.followingId, me), eq(follows.status, 'pending')));
    return reply.send({ user: updated });
  });

  app.patch('/auth/profile', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string };
    const body = request.body as {
      displayName?: unknown;
      username?: unknown;
      phone?: unknown;
      bio?: unknown;
    };

    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 100) : '';
    const username = typeof body.username === 'string' ? body.username.trim().replace(/^@/, '').toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 20) : '';
    const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 500) : '';

    if (!username || !/^[A-Za-z0-9_.]{2,30}$/.test(username)) {
      return reply.status(400).send({ error: 'INVALID_USERNAME' });
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${username}`)
      .limit(1);

    if (existing[0] && existing[0].id !== payload.id) {
      return reply.status(409).send({ error: 'USERNAME_TAKEN' });
    }

    if (phone) {
      const phoneOwner = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);
      if (phoneOwner[0] && phoneOwner[0].id !== payload.id) {
        return reply.status(409).send({ error: 'PHONE_TAKEN' });
      }
    }

    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          displayName: displayName || null,
          username,
          phone: phone || null,
          bio: bio || null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, payload.id))
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
          displayName: users.displayName,
          bio: users.bio,
          avatarUrl: users.avatarUrl,
        });

      if (!updatedUser) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
      return reply.send({ user: updatedUser });
    } catch (err: any) {
      if (err?.code === '23505' && String(err?.constraint || '').includes('username')) {
        return reply.status(409).send({ error: 'USERNAME_TAKEN' });
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
        supporterNumber: users.supporterNumber,
        supporterExpiresAt: users.supporterExpiresAt,
        verifiedAt: users.verifiedAt,
      })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
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
      .where(and(eq(follows.followingId, profile.id), eq(follows.status, 'accepted')));

    return reply.send({
      user: profile,
      isFollowing: Boolean(relation),
      followerCount: followersRow?.count ?? 0,
    });
  });

  app.post('/auth/users/:username/follow', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string };
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id, isPrivate: users.isPrivate }).from(users).where(eq(users.username, username)).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    if (target.id === payload.id) return reply.status(400).send({ error: 'CANNOT_FOLLOW_SELF' });

    await db.insert(follows).values({ followerId: payload.id, followingId: target.id, status: target.isPrivate ? 'pending' : 'accepted' }).onConflictDoNothing();
    const [relation] = await db.select({ status: follows.status }).from(follows).where(and(eq(follows.followerId, payload.id), eq(follows.followingId, target.id))).limit(1);
    const status = relation?.status ?? (target.isPrivate ? 'pending' : 'accepted');
    const actor=await db.execute(sql`SELECT username FROM users WHERE id=${payload.id} LIMIT 1`); const a:any=actor.rows[0]; await (app as any).notifyUser(target.id,target.isPrivate?'follow_request':'follow','متابعة جديدة',target.isPrivate?`@${a?.username||'مستخدم'} أرسل طلب متابعة`:`@${a?.username||'مستخدم'} بدأ بمتابعتك`,payload.id,{actorId:payload.id,url:'/u/'+encodeURIComponent(a?.username||'')}); return reply.send({ following: status === 'accepted', pending: status === 'pending' });
  });

  app.post('/auth/users/:username/follow/accept', { preHandler: verifyToken }, async (request, reply) => {
    const me = (request.user as { id: string }).id;
    const { username } = request.params as { username: string };
    const [requester] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!requester) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    await db.update(follows).set({ status: 'accepted' }).where(and(eq(follows.followerId, requester.id), eq(follows.followingId, me), eq(follows.status, 'pending')));
    return reply.send({ accepted: true });
  });

  app.post('/auth/users/:username/follow/reject', { preHandler: verifyToken }, async (request, reply) => {
    const me = (request.user as { id: string }).id;
    const { username } = request.params as { username: string };
    const [requester] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!requester) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    await db.delete(follows).where(and(eq(follows.followerId, requester.id), eq(follows.followingId, me), eq(follows.status, 'pending')));
    return reply.send({ rejected: true });
  });

  app.delete('/auth/users/:username/follow', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string };
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    await db.delete(follows).where(and(eq(follows.followerId, payload.id), eq(follows.followingId, target.id)));
    return reply.send({ following: false });
  });

  app.post('/auth/users/:username/block', { preHandler: verifyToken }, async (request, reply) => {
    const me = (request.user as { id: string }).id;
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username})=lower(${username})`).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    if (target.id === me) return reply.status(400).send({ error: 'CANNOT_BLOCK_SELF' });
    await db.execute(sql`INSERT INTO blocks(blocker_id,blocked_id) VALUES(${me},${target.id}) ON CONFLICT(blocker_id,blocked_id) DO NOTHING`);
    return reply.send({ blocked: true });
  });

  app.delete('/auth/users/:username/block', { preHandler: verifyToken }, async (request, reply) => {
    const me = (request.user as { id: string }).id;
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username})=lower(${username})`).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    await db.execute(sql`DELETE FROM blocks WHERE blocker_id=${me} AND blocked_id=${target.id}`);
    return reply.send({ blocked: false });
  });

  app.get('/auth/users/:username/block', { preHandler: verifyToken }, async (request, reply) => {
    const me = (request.user as { id: string }).id;
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username})=lower(${username})`).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    const row = await db.execute(sql`SELECT 1 FROM blocks WHERE blocker_id=${me} AND blocked_id=${target.id} LIMIT 1`);
    return reply.send({ blocked: Boolean(row.rows[0]) });
  });

  app.get('/auth/blocked', { preHandler: verifyToken }, async (request, reply) => {
    const me = (request.user as { id: string }).id;
    const rows = await db.execute(sql`SELECT u.id,u.username,u.display_name,u.avatar_url,b.created_at FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=${me} ORDER BY b.created_at DESC`);
    return reply.send({ users: rows.rows });
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
        supporterNumber: users.supporterNumber,
        supporterExpiresAt: users.supporterExpiresAt,
        verifiedAt: users.verifiedAt,
        isPrivate: users.isPrivate,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    }

    const payload = request.user as { id: string };
    const blocked = await db.execute(sql`SELECT 1 FROM blocks WHERE (blocker_id=${payload.id} AND blocked_id=${profile.id}) OR (blocker_id=${profile.id} AND blocked_id=${payload.id}) LIMIT 1`);
    if (blocked.rows[0]) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    const [followRelation] = await db.select({ id: follows.followerId, status: follows.status }).from(follows)
      .where(and(eq(follows.followerId, payload.id), eq(follows.followingId, profile.id))).limit(1);
    const canViewPrivate = payload.id === profile.id || (!profile.isPrivate) || followRelation?.status === 'accepted';

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
      .where(canViewPrivate ? eq(posts.userId, profile.id) : sql`false`)
      .groupBy(posts.id)
      .orderBy(desc(posts.createdAt));

    return reply.status(200).send({
      user: profile,
      posts: profilePosts,
      isFollowing: followRelation?.status === 'accepted',
      followRequestPending: followRelation?.status === 'pending',
      stats: {
        posts: profilePosts.length,
        followers: Number((await db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, profile.id)))[0]?.count ?? 0),
        following: Number((await db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, profile.id)))[0]?.count ?? 0),
      },
    });
  });

  app.get('/auth/users/:username/followers', { preHandler: verifyToken }, async (request, reply) => {
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    const [owner] = await db.select({ isPrivate: users.isPrivate }).from(users).where(eq(users.id, target.id)).limit(1);
    const allowed = !owner?.isPrivate || target.id === (request.user as {id:string}).id || Boolean((await db.select({id:follows.followerId}).from(follows).where(and(eq(follows.followerId,(request.user as {id:string}).id),eq(follows.followingId,target.id),eq(follows.status,'accepted'))).limit(1))[0]);
    if (!allowed) return reply.send({ users: [] });
    const rows = await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(follows).innerJoin(users, eq(users.id, follows.followerId))
      .where(and(eq(follows.followingId, target.id), eq(follows.status, 'accepted'))).orderBy(desc(users.username));
    return reply.send({ users: rows });
  });

  app.get('/auth/users/:username/following', { preHandler: verifyToken }, async (request, reply) => {
    const { username } = request.params as { username: string };
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    const [owner] = await db.select({ isPrivate: users.isPrivate }).from(users).where(eq(users.id, target.id)).limit(1);
    const allowed = !owner?.isPrivate || target.id === (request.user as {id:string}).id || Boolean((await db.select({id:follows.followerId}).from(follows).where(and(eq(follows.followerId,(request.user as {id:string}).id),eq(follows.followingId,target.id),eq(follows.status,'accepted'))).limit(1))[0]);
    if (!allowed) return reply.send({ users: [] });
    const rows = await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(follows).innerJoin(users, eq(users.id, follows.followingId))
      .where(and(eq(follows.followerId, target.id), eq(follows.status, 'accepted'))).orderBy(desc(users.username));
    return reply.send({ users: rows });
  });

  app.get('/auth/me', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string; username: string };
    return reply.status(200).send({ user: payload });
  });
}
