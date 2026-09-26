import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import jwt from '@fastify/jwt';
import 'dotenv/config';
import { authRoutes } from './modules/auth/auth.routes';

import { passwordResetRoutes } from './modules/password-reset/password-reset.routes';
import { postsRoutes } from './modules/posts/posts.routes';

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost', 'https://localhost', 'http://192.168.0.108:3000'],
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev_secret_change_me',
});

app.register(authRoutes);
app.register(passwordResetRoutes);
app.register(postsRoutes);

app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), '../web/dist'),
  prefix: '/',
});

app.get('/health', async () => {
  return { status: 'ok' };
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
