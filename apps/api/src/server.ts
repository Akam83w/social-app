import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import path from 'path';
import { sql } from 'drizzle-orm';
import webpush from 'web-push';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { db } from './db';
import { ensureAuthSchema } from './db/ensure-auth-schema';
import { authRoutes } from './modules/auth/auth.routes';
import { postsRoutes } from './modules/posts/posts.routes';
import { messagesRoutes } from './modules/messages.routes';
import { storiesRoutes } from './modules/stories.routes';
import { passwordResetRoutes } from './modules/password-reset/password-reset.routes';
import { verifyToken } from './middleware/auth.middleware';
import { videoRoutes } from './modules/video.routes';


const performanceRate = new Map<string, { count: number; resetAt: number }>();

function allowPerformanceSample(ip: string) {
  const now = Date.now();
  const current = performanceRate.get(ip);
  if (!current || current.resetAt <= now) {
    performanceRate.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}

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
  setupFirebaseMessaging();
  try {
    const row = await db.execute(sql`SELECT value FROM app_config WHERE key='vapid_keys' LIMIT 1`);
    let keys: any;
    if (row.rows[0]) {
      keys = JSON.parse(String((row.rows[0] as any).value));
    } else {
      keys = webpush.generateVAPIDKeys();
      await db.execute(sql`INSERT INTO app_config(key,value) VALUES('vapid_keys',${JSON.stringify(keys)}) ON CONFLICT(key) DO NOTHING`);
    }
    vapidPublicKey = keys.publicKey;
    webpush.setVapidDetails('mailto:admin@instairaq.local', keys.publicKey, keys.privateKey);
  } catch (error) {
    console.error('Push/realtime database initialization failed:', error);
  }
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

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');

const app = Fastify({ logger: true });
app.decorate('notifyUser', notifyUser);
const corsOrigin = process.env.CORS_ORIGIN || true;
app.register(cors, { origin: corsOrigin, credentials: true });
app.register(compress, { global: true, encodings: ['br', 'gzip'] });
app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
app.register(jwt, { secret: jwtSecret });
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
app.register(videoRoutes);
app.register(messagesRoutes);
app.register(storiesRoutes);
app.register(passwordResetRoutes);

app.post('/performance', async (request, reply) => {
  if (!allowPerformanceSample(request.ip)) return reply.status(204).send();
  const body = request.body as any;
  const name = String(body?.name || '').slice(0, 20);
  const value = Number(body?.value);
  const path = String(body?.path || '').slice(0, 200);
  if (!name || !Number.isFinite(value) || value < 0 || value > 120_000) return reply.status(204).send();
  request.log.info({ metric: name, value: Math.round(value * 100) / 100, path, connection: String(body?.connection || '').slice(0, 20) }, 'performance_metric');
  return reply.status(204).send();
});

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

app.get('/health', async (_request, reply) => { try { const result=await db.execute(sql`SELECT 1 AS ok`);return reply.status(200).send({status:'ok',database:result.rows[0]}); }catch(err:any){app.log.error(err);return reply.status(500).send({status:'error',database:{message:err?.message||String(err),code:err?.code||null,detail:err?.detail||null,hint:err?.hint||null}})} });

const start = async () => {
 try {
  await ensureAuthSchema();
  const port=Number(process.env.PORT)||3000;
  await app.listen({port,host:'0.0.0.0'});
  app.log.info({port},'HTTP server started');
  await setupRealtimeAndPush();
 }catch(err){app.log.error(err);}
};
start();
