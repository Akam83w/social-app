import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { db } from './db';
import { authRoutes } from './modules/auth/auth.routes';
import { postsRoutes } from './modules/posts/posts.routes';
import { messagesRoutes } from './modules/messages.routes';
import { storiesRoutes } from './modules/stories.routes';

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });
app.register(jwt, { secret: process.env.JWT_SECRET || 'change_this_to_a_long_random_string_later' });
app.register(fastifyStatic, { root: path.resolve(process.cwd(), process.cwd() === '/app' ? 'web/dist' : '../web/dist'), prefix: '/' });
app.register(authRoutes);
app.register(postsRoutes);
app.register(messagesRoutes);
app.register(storiesRoutes);

app.setNotFoundHandler(async (request, reply) => {
  if (request.method === 'GET' && !request.url.startsWith('/health')) return reply.sendFile('index.html');
  return reply.status(404).send({ error: 'NOT_FOUND' });
});

app.get('/dns-test', async (_request, reply) => { try { const net = await import('node:net'); const socket = new net.Socket(); const result = await new Promise((resolve,reject)=>{socket.setTimeout(5000);socket.connect(5432,'54.64.190.72',()=>{socket.destroy();resolve({connected:true,ip:'54.64.190.72',port:5432})});socket.on('error',reject);socket.on('timeout',()=>{socket.destroy();reject(new Error('Connection timeout'))})});return reply.status(200).send({status:'ok',addresses:result}); } catch(err:any){return reply.status(500).send({status:'error',message:err?.message||String(err),code:err?.code||null})} });
app.get('/db-test', async (_request, reply) => { try { const original=process.env.DATABASE_URL;if(!original)throw new Error('DATABASE_URL is not configured');const url=new URL(original);url.hostname='54.64.190.72';const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:false,servername:'aws-0-ap-northeast-1.pooler.supabase.com'}});try{const result=await pool.query('SELECT 1 AS ok');return reply.status(200).send({status:'ok',database:result.rows[0]})}finally{await pool.end()} }catch(err:any){app.log.error(err);return reply.status(500).send({status:'error',message:err?.message||String(err),code:err?.code||null,detail:err?.detail||null})} });
app.get('/health', async (_request, reply) => { try { const result=await db.execute(sql`SELECT 1 AS ok`);return reply.status(200).send({status:'ok',database:result.rows[0]}); }catch(err:any){app.log.error(err);return reply.status(500).send({status:'error',database:{message:err?.message||String(err),code:err?.code||null,detail:err?.detail||null,hint:err?.hint||null}})} });

const start = async () => {
 try {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS follows (follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT follows_pair_unique UNIQUE (follower_id, following_id))`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows(follower_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, content text NOT NULL, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_sender_receiver_idx ON messages(sender_id, receiver_id, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_receiver_sender_idx ON messages(receiver_id, sender_id, created_at)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS stories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, media_url text NOT NULL, media_type varchar(20) NOT NULL, content text, created_at timestamp NOT NULL DEFAULT now(), expires_at timestamp NOT NULL)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS stories_user_expires_idx ON stories(user_id, expires_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories(expires_at)`);
  const port=Number(process.env.PORT)||3000; await app.listen({port,host:'0.0.0.0'});
 }catch(err){app.log.error(err);process.exit(1)}
};
start();
