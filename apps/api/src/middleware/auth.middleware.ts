import type { FastifyRequest, FastifyReply } from 'fastify';
import { ensureAccountActive } from '../services/moderation.service';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function verifyToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as { id: string; authVersion?: number };
    if (payload.authVersion !== undefined) {
      const [u] = await db.select({ authVersion: users.authVersion }).from(users).where(eq(users.id, payload.id)).limit(1);
      if (!u || Number(u.authVersion || 1) !== Number(payload.authVersion)) throw new Error('SESSION_REVOKED');
    }
    await ensureAccountActive(payload.id);
  } catch (err) {
    if (err instanceof Error && err.message === 'ACCOUNT_SUSPENDED') {
      reply.status(403).send({ error: 'ACCOUNT_SUSPENDED' });
      return;
    }
    reply.status(401).send({ error: 'UNAUTHORIZED' });
  }
}
