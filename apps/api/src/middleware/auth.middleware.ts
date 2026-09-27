import type { FastifyRequest, FastifyReply } from 'fastify';
import { ensureAccountActive } from '../services/moderation.service';

export async function verifyToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    await ensureAccountActive((request.user as { id: string }).id);
  } catch (err) {
    if (err instanceof Error && err.message === 'ACCOUNT_SUSPENDED') {
      reply.status(403).send({ error: 'ACCOUNT_SUSPENDED' });
      return;
    }
    reply.status(401).send({ error: 'UNAUTHORIZED' });
  }
}
