import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from './auth.schema';
import { registerUser, loginUser } from './auth.service';
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
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        debug: {
          message: err.message,
          name: err.name,
          code: err.code,
          cause: err.cause ? { message: err.cause.message, code: err.cause.code } : null,
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
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        debug: {
          message: err.message,
          name: err.name,
          code: err.code,
          cause: err.cause ? { message: err.cause.message, code: err.cause.code } : null,
        },
      });
    }
  });

  app.get('/auth/me', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string; username: string };
    return reply.status(200).send({ user: payload });
  });
}
