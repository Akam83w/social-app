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
import { assertRedisReady, redisAddStreamEvent, redisIncr, redisExpire, redisReadStream } from './services/redis.service';


async function allowDistributedRateLimit(scope: string, key: string, limit: number, windowSeconds: number) {
  const redisKey = `rate:${scope}:${key}`;
  const count = Number(await redisIncr(redisKey));
  if (count === 1) await redisExpire(redisKey, windowSeconds);
  return count <= limit;
}

async function publishRealtime(userId: string, event: Record<string, unknown>) {
  try {
    await redisAddStreamEvent(`realtime:${userId}`, {
      type: String(event.type || 'event'),
      payload: JSON.stringify(event),
    });
  } catch (error) {
    console.error('Realtime publish failed:', error);
  }
}

const requireRedis = process.env.NODE_ENV === 'production' || process.env.REQUIRE_REDIS === 'true';
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
  await publishRealtime(userId, item);
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

const app = Fastify({ logger: true, bodyLimit: 200 * 1024 * 1024 });
app.decorate('notifyUser', notifyUser);
app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(self), microphone=(self)');
});

app.addHook('onRequest', async (request, reply) => {
  if (request.method !== 'POST' || !request.url.startsWith('/auth/')) return;
  if (await allowDistributedRateLimit('auth', request.ip, 20, 60)) return;
  reply.header('Retry-After', '60').status(429).send({ error: 'RATE_LIMITED' });
});

const corsOrigins = (process.env.CORS_ORIGIN || 'https://lush-topaz-3759.de.deplexo.com,https://localhost,capacitor://localhost,http://localhost,http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()).filter(Boolean);
app.register(cors, { origin: corsOrigins, credentials: true });
app.register(compress, { global: true, encodings: ['br', 'gzip'] });
app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
app.register(jwt, { secret: jwtSecret, sign: { expiresIn: '7d' } });
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
  if (!(await allowDistributedRateLimit('performance', request.ip, 30, 60))) return reply.status(204).send();
  const body = request.body as unknown;
  const metricBody = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
  const name = String(metricBody.name || '').slice(0, 20);
  const value = Number(metricBody.value);
  const path = String(metricBody.path || '').slice(0, 200);
  if (!name || !Number.isFinite(value) || value < 0 || value > 120_000) return reply.status(204).send();
  request.log.info({ metric: name, value: Math.round(value * 100) / 100, path, connection: String(metricBody.connection || '').slice(0, 20) }, 'performance_metric');
  return reply.status(204).send();
});

app.get('/notifications/config',{preHandler:verifyToken},async(_req,reply)=>reply.send({publicKey:vapidPublicKey}));
app.get('/notifications',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const r=await db.execute(sql`SELECT id,type,title,body,data,read_at,created_at FROM notifications WHERE user_id=${me} ORDER BY created_at DESC LIMIT 50`);return reply.send({notifications:r.rows});});
app.post('/notifications/read',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;await db.execute(sql`UPDATE notifications SET read_at=now() WHERE user_id=${me} AND read_at IS NULL`);return reply.send({ok:true});});
app.post('/notifications/push-subscription',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const sub=req.body as any;if(!sub?.endpoint)return reply.status(400).send({error:'INVALID_SUBSCRIPTION'});await db.execute(sql`INSERT INTO push_subscriptions(user_id,endpoint,subscription) VALUES(${me},${sub.endpoint},${JSON.stringify(sub)}) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,subscription=EXCLUDED.subscription`);return reply.send({ok:true});});
app.post('/notifications/fcm-token',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const b=req.body as any;if(!b?.token)return reply.status(400).send({error:'INVALID_FCM_TOKEN'});const platform=String(b.platform||'android').slice(0,20);await db.execute(sql`INSERT INTO fcm_tokens(user_id,token,platform) VALUES(${me},${String(b.token)},${platform}) ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,updated_at=now()`);return reply.send({ok:true});});
app.get('/realtime',async(req,reply)=>{
  const token=String((req.query as any)?.token||'');
  try{
    const payload=app.jwt.verify<{id:string}>(token);
    reply.hijack();
    reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    reply.raw.write('data: '+JSON.stringify({type:'ready'})+'\\n\\n');
    let lastId='0-0';
    let closed=false;
    req.raw.on('close',()=>{closed=true});
    while(!closed){
      const result=await redisReadStream(`realtime:${payload.id}`,lastId,15000);
      if(closed) break;
      if(!Array.isArray(result)) continue;
      for(const stream of result as any[]){
        const entries=Array.isArray(stream?.[1])?stream[1]:[];
        for(const entry of entries){
          const id=String(entry?.[0]||lastId);
          const fields=Array.isArray(entry?.[1])?entry[1]:[];
          let event:any=null;
          for(let i=0;i<fields.length;i+=2) if(fields[i]==='payload') { try{event=JSON.parse(String(fields[i+1]))}catch{} }
          if(event) reply.raw.write('data: '+JSON.stringify(event)+'\\n\\n');
          lastId=id;
        }
      }
    }
    return reply;
  }catch{return reply.status(401).send({error:'UNAUTHORIZED'});}
});
app.get('/calls/config',{preHandler:verifyToken},async(_req,reply)=>{
  const iceServers:any[]=[{urls:'stun:stun.l.google.com:19302'}];
  const turnUrl=String(process.env.TURN_URL||'').trim();
  const turnUsername=String(process.env.TURN_USERNAME||'').trim();
  const turnCredential=String(process.env.TURN_CREDENTIAL||'').trim();
  if(turnUrl&&turnUsername&&turnCredential)iceServers.push({urls:turnUrl,username:turnUsername,credential:turnCredential});
  return reply.send({iceServers});
});
app.post('/calls/start',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const b=req.body as any;
  if(!b?.toUserId)return reply.status(400).send({error:'INVALID_CALL'});
  if(b.toUserId===me)return reply.status(400).send({error:'CANNOT_CALL_SELF'});
  const u=await db.execute(sql`SELECT id FROM users WHERE id=${b.toUserId} LIMIT 1`);
  if(!u.rows[0])return reply.status(404).send({error:'USER_NOT_FOUND'});
  const blocked=await db.execute(sql`SELECT 1 FROM blocks WHERE (blocker_id=${me} AND blocked_id=${b.toUserId}) OR (blocker_id=${b.toUserId} AND blocked_id=${me}) LIMIT 1`);
  if(blocked.rows[0])return reply.status(403).send({error:'USER_BLOCKED'});
  const actor=await db.execute(sql`SELECT username,display_name FROM users WHERE id=${me} LIMIT 1`);
  const actorRow=(actor.rows[0] as any)||{};
  const r=await db.execute(sql`INSERT INTO calls(caller_id,callee_id,kind,status) VALUES(${me},${b.toUserId},${b.video?'video':'audio'},'ringing') RETURNING id`);
  const callId=String((r.rows[0] as any).id);
  const data={callId,username:actorRow.username||'',displayName:actorRow.display_name||actorRow.username||'مستخدم',video:Boolean(b.video),url:'/call?incoming=1&callId='+encodeURIComponent(callId)};
  void notifyUser(String(b.toUserId),'call','مكالمة واردة','@'+(actorRow.username||'مستخدم')+' يتصل بك',me,data).catch(()=>{});
  await db.execute(sql`UPDATE calls SET expires_at=now()+interval '30 seconds' WHERE id=${callId}`);
  await publishRealtime(String(b.toUserId), {type:'call',kind:'invite',callId,fromUserId:me,fromUsername:actorRow.username||'',fromDisplayName:actorRow.display_name||actorRow.username||'مستخدم',video:Boolean(b.video)});
  return reply.status(201).send({callId});
});
app.get('/calls/:id',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const {id}=req.params as {id:string};
  await db.execute(sql`UPDATE calls SET status='missed',ended_at=now() WHERE id=${id} AND status='ringing' AND expires_at IS NOT NULL AND expires_at<=now()`);
  const r=await db.execute(sql`SELECT c.id,c.caller_id,c.callee_id,c.kind,c.status,u.username,u.display_name FROM calls c JOIN users u ON u.id=c.caller_id WHERE c.id=${id} AND (c.caller_id=${me} OR c.callee_id=${me}) LIMIT 1`);
  if(!r.rows[0])return reply.status(404).send({error:'CALL_NOT_FOUND'}); return reply.send({call:r.rows[0]});
});
app.post('/calls/:id/accept',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const {id}=req.params as {id:string};
  const r=await db.execute(sql`UPDATE calls SET status='accepted',started_at=now() WHERE id=${id} AND callee_id=${me} AND status='ringing' RETURNING caller_id`);
  if(!r.rows[0])return reply.status(409).send({error:'CALL_NOT_AVAILABLE'});
  await publishRealtime(String((r.rows[0] as any).caller_id), {type:'call',kind:'accept',callId:id,fromUserId:me});
  return reply.send({ok:true});
});
app.post('/calls/:id/reject',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const {id}=req.params as {id:string};
  const r=await db.execute(sql`UPDATE calls SET status='rejected',ended_at=now() WHERE id=${id} AND callee_id=${me} AND status='ringing' RETURNING caller_id`);
  if(!r.rows[0])return reply.status(409).send({error:'CALL_NOT_AVAILABLE'});
  await publishRealtime(String((r.rows[0] as any).caller_id), {type:'call',kind:'reject',callId:id,fromUserId:me});
  return reply.send({ok:true});
});
app.post('/calls/:id/end',{preHandler:verifyToken},async(req,reply)=>{
  const me=(req.user as {id:string}).id; const {id}=req.params as {id:string};
  const r=await db.execute(sql`UPDATE calls SET status='ended',ended_at=now() WHERE id=${id} AND (caller_id=${me} OR callee_id=${me}) AND status IN ('ringing','accepted') RETURNING caller_id,callee_id`);
  if(!r.rows[0])return reply.send({ok:true});
  const row=r.rows[0] as any; const other=String(row.caller_id)===me?String(row.callee_id):String(row.caller_id);
  await publishRealtime(other, {type:'call',kind:'hangup',callId:id,fromUserId:me});
  return reply.send({ok:true});
});
app.post('/calls/signal',{preHandler:verifyToken},async(req,reply)=>{const me=(req.user as {id:string}).id;const b=req.body as any;if(!b?.toUserId||!b?.kind)return reply.status(400).send({error:'INVALID_SIGNAL'});const callId=String(b.payload?.callId||'');if(!callId)return reply.status(400).send({error:'INVALID_SIGNAL'});const call=await db.execute(sql`SELECT caller_id,callee_id,status FROM calls WHERE id=${callId} AND status IN ('ringing','accepted') AND (caller_id=${me} OR callee_id=${me}) LIMIT 1`);const row=call.rows[0] as any;if(!row)return reply.status(403).send({error:'CALL_NOT_AVAILABLE'});const expectedPeer=String(row.caller_id)===me?String(row.callee_id):String(row.caller_id);if(String(b.toUserId)!==expectedPeer)return reply.status(403).send({error:'INVALID_CALL_PEER'});const meRow=await db.execute(sql`SELECT username FROM users WHERE id=${me} LIMIT 1`);const fromUsername=(meRow.rows[0] as any)?.username||'';await publishRealtime(expectedPeer, {type:'call',callId,fromUserId:me,fromUsername,kind:b.kind,payload:b.payload});return reply.send({ok:true});});
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
  if (requireRedis) await assertRedisReady();
  await app.listen({port,host:'0.0.0.0'});
  app.log.info({port},'HTTP server started');
  await setupRealtimeAndPush();
  const sweep = async () => {
    try {
      const expired = await db.execute(sql`UPDATE calls SET status='missed',ended_at=now() WHERE status='ringing' AND expires_at IS NOT NULL AND expires_at<=now() RETURNING id,caller_id,callee_id`);
      for (const row of expired.rows as any[]) {
        await notifyUser(String(row.caller_id),'missed_call','مكالمة فائتة','لم يرد المستخدم على مكالمتك',String(row.callee_id),{callId:String(row.id)});
        await notifyUser(String(row.callee_id),'missed_call','مكالمة فائتة','فاتتك مكالمة',String(row.caller_id),{callId:String(row.id)});
      }
    } catch (error) { app.log.error(error, 'expired call sweep failed'); }
  };
  setInterval(() => void sweep(), 5000).unref();
 }catch(err){app.log.error(err);}
};
start();
