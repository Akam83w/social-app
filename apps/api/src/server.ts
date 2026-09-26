import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { authRoutes } from './modules/auth/auth.routes';

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: true,
  credentials: true,
});

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'change_this_to_a_long_random_string_later',
});

app.register(fastifyStatic, {
  root: path.resolve(
    process.cwd(),
    process.cwd() === '/app' ? 'web/dist' : '../web/dist',
  ),
  prefix: '/',
});

app.register(authRoutes);

app.setNotFoundHandler(async (request, reply) => {
  if (request.method === 'GET' && !request.url.startsWith('/health')) {
    return reply.sendFile('index.html');
  }

  return reply.status(404).send({
    error: 'NOT_FOUND',
  });
});

app.get('/health', async (_request, reply) => {
  try {
    const result = await db.execute(sql`SELECT 1 AS ok`);

    return reply.status(200).send({
      status: 'ok',
      database: result.rows[0],
    });
  } catch (err: any) {
    app.log.error(err);

    return reply.status(500).send({
      status: 'error',
      database: err?.message || String(err),
    });
  }
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
