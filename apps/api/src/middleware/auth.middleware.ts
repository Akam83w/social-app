import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function verifyToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as { id: string; authVersion?: number };
    const [u] = await db.select({ authVersion: users.authVersion, moderationStatus: users.moderationStatus, suspendedUntil: users.suspendedUntil })
      .from(users).where(eq(users.id, payload.id)).limit(1);
    if (!u || Number(u.authVersion || 1) !== Number(payload.authVersion ?? 1)) throw new Error('SESSION_REVOKED');
    if (u.suspendedUntil && u.suspendedUntil.getTime() <= Date.now()) {
      void db.update(users).set({ moderationStatus: 'active', suspendedUntil: null, updatedAt: new Date() }).where(eq(users.id, payload.id)).then(() => {}, () => {});
    } else if (u.moderationStatus === 'suspended') {
      throw new Error('ACCOUNT_SUSPENDED');
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'ACCOUNT_SUSPENDED') {
      reply.status(403).send({ error: 'ACCOUNT_SUSPENDED' });
      return;
    }
    reply.status(401).send({ error: 'UNAUTHORIZED' });
  }
}
