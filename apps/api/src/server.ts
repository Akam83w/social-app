import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { Pool } from 'pg';
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

app.get('/dns-test', async (_request, reply) => {
  const dns = await import('node:dns/promises');

  try {
    const net = await import('node:net');

    const socket = new net.Socket();

    const result = await new Promise((resolve, reject) => {
      socket.setTimeout(5000);

      socket.connect(5432, '54.64.190.72', () => {
        socket.destroy();
        resolve({
          connected: true,
          ip: '54.64.190.72',
          port: 5432,
        });
      });

      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
    });

    return reply.status(200).send({
      status: 'ok',
      addresses: result,
    });
  } catch (err: any) {
    return reply.status(500).send({
      status: 'error',
      message: err?.message || String(err),
      code: err?.code || null,
    });
  }
});

app.get('/health', async (_request, reply) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const result = await pool.query('SELECT 1 AS ok');

    return reply.status(200).send({
      status: 'ok',
      database: result.rows[0],
    });
  } catch (err: any) {
    app.log.error(err);

    return reply.status(500).send({
      status: 'error',
      database: {
        message: err?.message || String(err),
        code: err?.code || null,
        detail: err?.detail || null,
        hint: err?.hint || null,
      },
    });
  } finally {
    await pool.end();
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
