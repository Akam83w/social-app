import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import webpush from 'web-push';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { db } from './db';
import { authRoutes } from './modules/auth/auth.routes';
import { postsRoutes } from './modules/posts/posts.routes';
import { messagesRoutes } from './modules/messages.routes';
import { storiesRoutes } from './modules/stories.routes';
import { passwordResetRoutes } from './modules/password-reset/password-reset.routes';
import { verifyToken } from './middleware/auth.middleware';


const realtimeClients = new Map<string, Set<any>>();
const callTimers = new Map<string, ReturnType<typeof setTimeout>>();
let vapidPublicKey = '';
let firebaseMessaging: Messaging | null = null;

function setupFirebaseMessaging() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return;
  try {
    const serviceAccount = JSON.parse(raw);
    const firebaseApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    firebaseMessaging = getMessaging(firebaseApp);
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error);
    firebaseMessaging = null;
  }
}

async function setupRealtimeAndPush() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_id uuid NOT NULL, target_type varchar(20) NOT NULL, reason text NOT NULL, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS reports_target_idx ON reports(target_type,target_id)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS blocks (blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT blocks_pair_unique UNIQUE(blocker_id,blocked_id))`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON blocks(blocker_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks(blocked_id)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS app_config (key text PRIMARY KEY, value text NOT NULL)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, actor_id uuid REFERENCES users(id) ON DELETE CASCADE, type varchar(30) NOT NULL, title text NOT NULL, body text NOT NULL, data text, read_at timestamp, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint text NOT NULL UNIQUE, subscription text NOT NULL, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS fcm_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token text NOT NULL UNIQUE, platform varchar(20) NOT NULL DEFAULT 'android', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS fcm_tokens_user_idx ON fcm_tokens(user_id)`);
  setupFirebaseMessaging();
  const row=await db.execute(sql`SELECT value FROM app_config WHERE key='vapid_keys' LIMIT 1`);
  let keys:any;
  if(row.rows[0]) keys=JSON.parse(String((row.rows[0] as any).value)); else { keys=webpush.generateVAPIDKeys(); await db.execute(sql`INSERT INTO app_config(key,value) VALUES('vapid_keys',${JSON.stringify(keys)}) ON CONFLICT(key) DO NOTHING`); }
  vapidPublicKey=keys.publicKey; webpush.setVapidDetails('mailto:admin@instairaq.local',keys.publicKey,keys.privateKey);
}
async function notifyUser(userId:string,type:string,title:string,body:string,actorId?:string,data:any={}) {
  const r=await db.execute(sql`INSERT INTO notifications(user_id,actor_id,type,title,body,data) VALUES(${userId},${actorId||null},${type},${title},${body},${JSON.stringify(data)}) RETURNING id,created_at`);
  const item={id:(r.rows[0] as any).id,type:'notification',notificationType:type,title,body,data,createdAt:(r.rows[0] as any).created_at};
  for(const res of realtimeClients.get(userId)||[]) res.write(`data: ${JSON.stringify(item)}\\n\\n`);
  const subs=await db.execute(sql`SELECT id,subscription FROM push_subscriptions WHERE user_id=${userId}`);
  for(const s of subs.rows as any[]) try{await webpush.sendNotification(JSON.parse(s.subscription),JSON.stringify({title,body,data}),{TTL:60,urgency:'high'});}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await db.execute(sql`DELETE FROM push_subscriptions WHERE id=${s.id}`);}
  if(firebaseMessaging){
    const tokens=await db.execute(sql`SELECT id,token FROM fcm_tokens WHERE user_id=${userId}`);
    const fcmData: Record<string,string>={type,title,body};
    for(const [key,value] of Object.entries(data||{})) fcmData[key]=typeof value==='string'?value:JSON.stringify(value);
    for(const row of tokens.rows as any[]) try{await firebaseMessaging.send({token:String(row.token),data:fcmData,android:{priority:'high'}});}catch(e:any){const code=String(e?.code||'');if(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token'))await db.execute(sql`DELETE FROM fcm_tokens WHERE id=${row.id}`);}
  }
}

let startupReady = false;
const app = Fastify({ logger: true });
app.decorate('notifyUser', notifyUser);
app.register(cors, { origin: true, credentials: true });
app.register(jwt, { secret: process.env.JWT_SECRET || 'change_this_to_a_long_random_string_later' });
app.register(fastifyStatic, { root: path.resolve(process.cwd(), process.cwd() === '/app' ? 'web/dist' : '../web/dist'), prefix: '/' });
app.post('/moderation/appeal', async (request, reply) => {
  try {
    await request.jwtVerify();
    const userId=(request.user as {id:string}).id;
    const body=request.body as {reason?:string};
    const reason=String(body.reason||'').trim().slice(0,2000);
    if(!reason)return reply.status(400).send({error:'VALIDATION_ERROR'});
    const existing=await db.execute(sql`SELECT id FROM moderation_appeals WHERE user_id=${userId} AND status='pending' LIMIT 1`);
    if(existing.rows[0])return reply.status(409).send({error:'APPEAL_ALREADY_PENDING'});
    const result=await db.execute(sql`INSERT INTO moderation_appeals(user_id,reason) VALUES(${userId},${reason}) RETURNING id,created_at`);
    return reply.status(201).send({appeal:result.rows[0]});
  } catch { return reply.status(401).send({error:'UNAUTHORIZED'}); }
});

app.register(authRoutes);
app.register(postsRoutes);
app.register(messagesRoutes);
app.register(storiesRoutes);
app.register(passwordResetRoutes);

app.get('/notifications/config',{preHandler:verifyToken},async(_req,reply)=>reply.send({publicKey:vapidPublicKey}));
app.get('/notifications',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const r=await db.execute(sql`SELECT id,type,title,body,data,read_at,created_at FROM notifications WHERE user_id=${me} ORDER BY created_at DESC LIMIT 50`);return reply.send({notifications:r.rows});});
app.post('/notifications/read',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;await db.execute(sql`UPDATE notifications SET read_at=now() WHERE user_id=${me} AND read_at IS NULL`);return reply.send({ok:true});});
app.post('/notifications/push-subscription',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const sub=req.body as any;if(!sub?.endpoint)return reply.status(400).send({error:'INVALID_SUBSCRIPTION'});await db.execute(sql`INSERT INTO push_subscriptions(user_id,endpoint,subscription) VALUES(${me},${sub.endpoint},${JSON.stringify(sub)}) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,subscription=EXCLUDED.subscription`);return reply.send({ok:true});});
app.post('/notifications/fcm-token',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const b=req.body as any;if(!b?.token)return reply.status(400).send({error:'INVALID_FCM_TOKEN'});const platform=String(b.platform||'android').slice(0,20);await db.execute(sql`INSERT INTO fcm_tokens(user_id,token,platform) VALUES(${me},${String(b.token)},${platform}) ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,updated_at=now()`);return reply.send({ok:true});});
app.get('/realtime',async(req,reply)=>{const token=String((req.query as any)?.token||'');try{const payload=app.jwt.verify<{id:string}>(token);reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});reply.raw.write('data: '+JSON.stringify({type:'ready'})+'\\n\\n');let set=realtimeClients.get(payload.id);if(!set){set=new Set();realtimeClients.set(payload.id,set)}set.add(reply.raw);req.raw.on('close',()=>{set?.delete(reply.raw);if(!set?.size)realtimeClients.delete(payload.id)});return reply;}catch{return reply.status(401).send({error:'UNAUTHORIZED'});}});
app.post('/calls/start',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const b=req.body as any;
  if(!b?.toUserId)return reply.status(400).send({error:'INVALID_CALL'});
  if(b.toUserId===me)return reply.status(400).send({error:'CANNOT_CALL_SELF'});
  const u=await db.execute(sql`SELECT id FROM users WHERE id=${b.toUserId} LIMIT 1`);
  if(!u.rows[0])return reply.status(404).send({error:'USER_NOT_FOUND'});
  const actor=await db.execute(sql`SELECT username,display_name FROM users WHERE id=${me} LIMIT 1`);
  const actorRow=(actor.rows[0] as any)||{};
  const r=await db.execute(sql`INSERT INTO calls(caller_id,callee_id,kind,status) VALUES(${me},${b.toUserId},${b.video?'video':'audio'},'ringing') RETURNING id`);
  const callId=String((r.rows[0] as any).id);
  const data={callId,username:actorRow.username||'',displayName:actorRow.display_name||actorRow.username||'مستخدم',video:Boolean(b.video),url:'/call?incoming=1&callId='+encodeURIComponent(callId)};
  void notifyUser(String(b.toUserId),'call','مكالمة واردة','@'+(actorRow.username||'مستخدم')+' يتصل بك',me,data).catch(()=>{});
  const timer=setTimeout(async()=>{try{
    const x=await db.execute(sql`UPDATE calls SET status='missed',ended_at=now() WHERE id=${callId} AND status='ringing' RETURNING caller_id,callee_id`);
    if(x.rows[0]){const row=x.rows[0] as any;await notifyUser(String(row.caller_id),'missed_call','مكالمة فائتة','لم يرد المستخدم على مكالمتك',String(row.callee_id),{callId});await notifyUser(String(row.callee_id),'missed_call','مكالمة فائتة','فاتتك مكالمة',String(row.caller_id),{callId});}
  }finally{callTimers.delete(callId)}},30000);
  callTimers.set(callId,timer);
  for(const res of realtimeClients.get(String(b.toUserId))||[])res.write(`data: ${JSON.stringify({type:'call',kind:'invite',callId,fromUserId:me,fromUsername:actorRow.username||'',fromDisplayName:actorRow.display_name||actorRow.username||'مستخدم',video:Boolean(b.video)})}\\n\\n`);
  return reply.status(201).send({callId});
});
app.get('/calls/:id',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const {id}=req.params as {id:string};
  const r=await db.execute(sql`SELECT c.id,c.caller_id,c.callee_id,c.kind,c.status,u.username,u.display_name FROM calls c JOIN users u ON u.id=c.caller_id WHERE c.id=${id} AND (c.caller_id=${me} OR c.callee_id=${me}) LIMIT 1`);
  if(!r.rows[0])return reply.status(404).send({error:'CALL_NOT_FOUND'}); return reply.send({call:r.rows[0]});
});
app.post('/calls/:id/accept',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const {id}=req.params as {id:string};
  const r=await db.execute(sql`UPDATE calls SET status='accepted',started_at=now() WHERE id=${id} AND callee_id=${me} AND status='ringing' RETURNING caller_id`);
  if(!r.rows[0])return reply.status(409).send({error:'CALL_NOT_AVAILABLE'});
  const timer=callTimers.get(id); if(timer)clearTimeout(timer); callTimers.delete(id);
  for(const res of realtimeClients.get(String((r.rows[0] as any).caller_id))||[])res.write(`data: ${JSON.stringify({type:'call',kind:'accept',callId:id,fromUserId:me})}\\n\\n`);
  return reply.send({ok:true});
});
app.post('/calls/:id/reject',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const {id}=req.params as {id:string};
  const r=await db.execute(sql`UPDATE calls SET status='rejected',ended_at=now() WHERE id=${id} AND callee_id=${me} AND status='ringing' RETURNING caller_id`);
  if(!r.rows[0])return reply.status(409).send({error:'CALL_NOT_AVAILABLE'});
  const timer=callTimers.get(id); if(timer)clearTimeout(timer); callTimers.delete(id);
  for(const res of realtimeClients.get(String((r.rows[0] as any).caller_id))||[])res.write(`data: ${JSON.stringify({type:'call',kind:'reject',callId:id,fromUserId:me})}\\n\\n`);
  return reply.send({ok:true});
});
app.post('/calls/:id/end',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const {id}=req.params as {id:string};
  const r=await db.execute(sql`UPDATE calls SET status='ended',ended_at=now() WHERE id=${id} AND (caller_id=${me} OR callee_id=${me}) AND status IN ('ringing','accepted') RETURNING caller_id,callee_id`);
  if(!r.rows[0])return reply.send({ok:true});
  const timer=callTimers.get(id); if(timer)clearTimeout(timer); callTimers.delete(id);
  const row=r.rows[0] as any; const other=String(row.caller_id)===me?String(row.callee_id):String(row.caller_id);
  for(const res of realtimeClients.get(other)||[])res.write(`data: ${JSON.stringify({type:'call',kind:'hangup',callId:id,fromUserId:me})}\\n\\n`);
  return reply.send({ok:true});
});
app.post('/calls/signal',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const b=req.body as any;if(!b?.toUserId||!b?.kind)return reply.status(400).send({error:'INVALID_SIGNAL'});const meRow=await db.execute(sql`SELECT username FROM users WHERE id=${me} LIMIT 1`);const fromUsername=(meRow.rows[0] as any)?.username||'';const callId=String(b.payload?.callId||'');for(const res of realtimeClients.get(b.toUserId)||[])res.write(`data: ${JSON.stringify({type:"call",callId,fromUserId:me,fromUsername,kind:b.kind,payload:b.payload})}\\n\\n`);return reply.send({ok:true});});
app.get('/sw.js',async(_req,reply)=>reply.type('application/javascript').send(`self.addEventListener('push',e=>{let d={title:'إنستعراق',body:'إشعار جديد',data:{}};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'/favicon.svg',data:d.data||{}}))});self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow(e.notification.data?.url||'/notifications'))});`));


app.setNotFoundHandler(async (request, reply) => {
  if (request.method === 'GET' && !request.url.startsWith('/health')) return reply.sendFile('index.html');
  return reply.status(404).send({ error: 'NOT_FOUND' });
});

app.get('/dns-test', async (_request, reply) => { try {
  await setupRealtimeAndPush(); const net = await import('node:net'); const socket = new net.Socket(); const result = await new Promise((resolve,reject)=>{socket.setTimeout(5000);socket.connect(5432,'54.64.190.72',()=>{socket.destroy();resolve({connected:true,ip:'54.64.190.72',port:5432})});socket.on('error',reject);socket.on('timeout',()=>{socket.destroy();reject(new Error('Connection timeout'))})});return reply.status(200).send({status:'ok',addresses:result}); } catch(err:any){return reply.status(500).send({status:'error',message:err?.message||String(err),code:err?.code||null})} });
app.get('/db-test', async (_request, reply) => { try { const original=process.env.DATABASE_URL;if(!original)throw new Error('DATABASE_URL is not configured');const url=new URL(original);url.hostname='54.64.190.72';const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:false,servername:'aws-0-ap-northeast-1.pooler.supabase.com'}});try{const result=await pool.query('SELECT 1 AS ok');return reply.status(200).send({status:'ok',database:result.rows[0]})}finally{await pool.end()} }catch(err:any){app.log.error(err);return reply.status(500).send({status:'error',message:err?.message||String(err),code:err?.code||null,detail:err?.detail||null})} });
app.get('/health', async (_request, reply) => { if(!startupReady)return reply.status(200).send({status:'starting'}); try { const result=await db.execute(sql`SELECT 1 AS ok`);return reply.status(200).send({status:'ok',database:result.rows[0]}); }catch(err:any){app.log.error(err);return reply.status(500).send({status:'error',database:{message:err?.message||String(err),code:err?.code||null,detail:err?.detail||null,hint:err?.hint||null}})} });

const start = async () => {
 try {
  const port=Number(process.env.PORT)||3000;
  await app.listen({port,host:'0.0.0.0'});
  app.log.info({port},'HTTP server is listening; running startup database setup');
  await setupRealtimeAndPush();
  await db.execute(sql`CREATE TABLE IF NOT EXISTS follows (follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT follows_pair_unique UNIQUE (follower_id, following_id))`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows(follower_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS supporter_number varchar(10)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS supporter_expires_at timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE follows ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'accepted'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_strikes varchar(10) NOT NULL DEFAULT '0'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_status varchar(20) NOT NULL DEFAULT 'active'`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS moderation_violations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_id uuid, target_type varchar(20) NOT NULL, violation_type varchar(50) NOT NULL, severity varchar(20) NOT NULL, action varchar(30) NOT NULL, reason text, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS moderation_violations_user_idx ON moderation_violations(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS moderation_violations_created_idx ON moderation_violations(created_at)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS moderation_appeals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, reason text NOT NULL, status varchar(20) NOT NULL DEFAULT 'pending', created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS moderation_appeals_user_idx ON moderation_appeals(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS moderation_appeals_status_idx ON moderation_appeals(status)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_supporter_number_unique ON users(supporter_number) WHERE supporter_number IS NOT NULL`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users(lower(username))`);
  await db.execute(sql`UPDATE users SET verified_at=COALESCE(verified_at, created_at) WHERE lower(email)=lower('sdmtr033@gmail.com')`);
  await db.execute(sql`WITH ranked AS (SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn FROM users WHERE supporter_number IS NULL) UPDATE users u SET supporter_number=ranked.rn::text, supporter_expires_at=u.created_at + interval '90 days' FROM ranked WHERE u.id=ranked.id AND ranked.rn <= 1932`);
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS supporter_number_seq START WITH 1`);
  await db.execute(sql`SELECT setval('supporter_number_seq', GREATEST(COALESCE((SELECT MAX(supporter_number::int) FROM users WHERE supporter_number ~ '^[0-9]+$'),0)+1,1), false)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS calls (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), caller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, callee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind varchar(10) NOT NULL, status varchar(20) NOT NULL, created_at timestamp NOT NULL DEFAULT now(), started_at timestamp, ended_at timestamp)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS calls_caller_created_idx ON calls(caller_id,created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS calls_callee_created_idx ON calls(callee_id,created_at DESC)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, content text NOT NULL, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_sender_receiver_idx ON messages(sender_id, receiver_id, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_receiver_sender_idx ON messages(receiver_id, sender_id, created_at)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS stories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, media_url text NOT NULL, media_type varchar(20) NOT NULL, content text, created_at timestamp NOT NULL DEFAULT now(), expires_at timestamp NOT NULL)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS stories_user_expires_idx ON stories(user_id, expires_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories(expires_at)`);
  startupReady=true;
  app.log.info('Startup database setup completed; app is ready');
 }catch(err){app.log.error(err);process.exit(1)}
};
start();
