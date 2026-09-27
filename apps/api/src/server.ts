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
import { verifyToken } from './middleware/auth.middleware';


const realtimeClients = new Map<string, Set<any>>();
let vapidPublicKey = '';
async function setupRealtimeAndPush() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS app_config (key text PRIMARY KEY, value text NOT NULL)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, actor_id uuid REFERENCES users(id) ON DELETE CASCADE, type varchar(30) NOT NULL, title text NOT NULL, body text NOT NULL, data text, read_at timestamp, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint text NOT NULL UNIQUE, subscription text NOT NULL, created_at timestamp NOT NULL DEFAULT now())`);
}
async function notifyUser(userId:string,type:string,title:string,body:string,actorId?:string,data:any={}) {
  const r=await db.execute(sql\`INSERT INTO notifications(user_id,actor_id,type,title,body,data) VALUES(${userId},${actorId||null},${type},${title},${body},${JSON.stringify(data)}) RETURNING id,created_at\`);
  const item={id:(r.rows[0] as any).id,type:'notification',notificationType:type,title,body,data,createdAt:(r.rows[0] as any).created_at};
  for(const res of realtimeClients.get(userId)||[]) res.write(`data: ${JSON.stringify(item)}\\n\\n`);
  const subs=await db.execute(sql\`SELECT id,subscription FROM push_subscriptions WHERE user_id=${userId}\`);
  for(const s of subs.rows as any[]) try{await webpush.sendNotification(JSON.parse(s.subscription),JSON.stringify({title,body,data}),{TTL:60,urgency:'high'});}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await db.execute(sql\`DELETE FROM push_subscriptions WHERE id=${s.id}\`);}
}

const app = Fastify({ logger: true });
app.decorate('notifyUser', notifyUser);
app.register(cors, { origin: true, credentials: true });
app.register(jwt, { secret: process.env.JWT_SECRET || 'change_this_to_a_long_random_string_later' });
app.register(fastifyStatic, { root: path.resolve(process.cwd(), process.cwd() === '/app' ? 'web/dist' : '../web/dist'), prefix: '/' });
app.register(authRoutes);
app.register(postsRoutes);
app.register(messagesRoutes);
app.register(storiesRoutes);

app.get('/notifications/config',{preHandler:verifyToken},async(_req,reply)=>reply.send({publicKey:vapidPublicKey}));
app.get('/notifications',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const r=await db.execute(sql\`SELECT id,type,title,body,data,read_at,created_at FROM notifications WHERE user_id=${me} ORDER BY created_at DESC LIMIT 50\`);return reply.send({notifications:r.rows});});
app.post('/notifications/read',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;await db.execute(sql\`UPDATE notifications SET read_at=now() WHERE user_id=${me} AND read_at IS NULL\`);return reply.send({ok:true});});
app.post('/notifications/push-subscription',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const sub=req.body as any;if(!sub?.endpoint)return reply.status(400).send({error:'INVALID_SUBSCRIPTION'});await db.execute(sql\`INSERT INTO push_subscriptions(user_id,endpoint,subscription) VALUES(${me},${sub.endpoint},${JSON.stringify(sub)}) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,subscription=EXCLUDED.subscription\`);return reply.send({ok:true});});
app.get('/realtime',async(req,reply)=>{const token=String((req.query as any)?.token||'');try{const payload=app.jwt.verify<{id:string}>(token);reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});reply.raw.write('data: '+JSON.stringify({type:'ready'})+'\\n\\n');let set=realtimeClients.get(payload.id);if(!set){set=new Set();realtimeClients.set(payload.id,set)}set.add(reply.raw);req.raw.on('close',()=>{set?.delete(reply.raw);if(!set?.size)realtimeClients.delete(payload.id)});return reply;}catch{return reply.status(401).send({error:'UNAUTHORIZED'});}});
app.post('/calls/signal',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const b=req.body as any;if(!b?.toUserId||!b?.kind)return reply.status(400).send({error:'INVALID_SIGNAL'});const meRow=await db.execute(sql\`SELECT username FROM users WHERE id=${me} LIMIT 1\`);const fromUsername=(meRow.rows[0] as any)?.username||'';for(const res of realtimeClients.get(b.toUserId)||[])res.write(\`data: ${JSON.stringify({type:"call",fromUserId:me,fromUsername,kind:b.kind,payload:b.payload})}\\n\\n\`);return reply.send({ok:true});});
app.get('/sw.js',async(_req,reply)=>reply.type('application/javascript').send(`self.addEventListener('push',e=>{let d={title:'إنستعراق',body:'إشعار جديد',data:{}};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'/favicon.svg',data:d.data||{}}))});self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow(e.notification.data?.url||'/notifications'))});`));


app.setNotFoundHandler(async (request, reply) => {
  if (request.method === 'GET' && !request.url.startsWith('/health')) return reply.sendFile('index.html');
  return reply.status(404).send({ error: 'NOT_FOUND' });
});

app.get('/dns-test', async (_request, reply) => { try {
  await setupRealtimeAndPush(); const net = await import('node:net'); const socket = new net.Socket(); const result = await new Promise((resolve,reject)=>{socket.setTimeout(5000);socket.connect(5432,'54.64.190.72',()=>{socket.destroy();resolve({connected:true,ip:'54.64.190.72',port:5432})});socket.on('error',reject);socket.on('timeout',()=>{socket.destroy();reject(new Error('Connection timeout'))})});return reply.status(200).send({status:'ok',addresses:result}); } catch(err:any){return reply.status(500).send({status:'error',message:err?.message||String(err),code:err?.code||null})} });
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
