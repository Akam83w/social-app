import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from './auth.schema';
import { registerUser, loginUser, updateUserAvatar } from './auth.service';
import { verifyToken } from '../../middleware/auth.middleware';

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
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
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

  app.get('/auth/me', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string; username: string };
    return reply.status(200).send({ user: payload });
  });
}
