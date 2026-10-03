import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { verifyToken } from '../middleware/auth.middleware';

export async function messagesRoutes(app: FastifyInstance){
 app.get('/messages/notes',{preHandler:verifyToken},async(request,reply)=>{
  const me=(request.user as {id:string}).id;
  void db.execute(sql`UPDATE users SET last_active_at=now() WHERE id=${me} AND (last_active_at IS NULL OR last_active_at < now() - interval '60 seconds')`).then(() => {}, () => {});
  const rows=await db.execute(sql`SELECT n.user_id,n.content,n.created_at,n.expires_at,u.username,u.display_name,u.avatar_url,(u.last_active_at > now() - interval '5 minutes') AS is_active FROM user_notes n JOIN users u ON u.id=n.user_id WHERE n.expires_at>now() AND (n.user_id=${me} OR n.user_id IN (SELECT following_id FROM follows WHERE follower_id=${me} AND status='accepted') OR n.user_id IN (SELECT follower_id FROM follows WHERE following_id=${me} AND status='accepted') OR n.user_id IN (SELECT sender_id FROM messages WHERE receiver_id=${me}) OR n.user_id IN (SELECT receiver_id FROM messages WHERE sender_id=${me})) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${me} AND b.blocked_id=n.user_id) OR (b.blocker_id=n.user_id AND b.blocked_id=${me})) ORDER BY CASE WHEN n.user_id=${me} THEN 0 WHEN u.last_active_at>now()-interval '5 minutes' THEN 1 ELSE 2 END,n.created_at DESC LIMIT 50`);
  return {notes:rows.rows.map((r:any)=>({user:{id:r.user_id,username:r.username,displayName:r.display_name,avatarUrl:r.avatar_url},content:r.content,createdAt:r.created_at,expiresAt:r.expires_at,isActive:Boolean(r.is_active)}))};
 });
 app.post('/messages/notes',{preHandler:verifyToken},async(request,reply)=>{
  const me=(request.user as {id:string}).id; const content=String((request.body as any)?.content||'').trim().slice(0,60); if(!content)return reply.status(400).send({error:'VALIDATION_ERROR'});
  await db.execute(sql`INSERT INTO user_notes(user_id,content,updated_at,expires_at) VALUES(${me},${content},now(),now()+interval '24 hours') ON CONFLICT(user_id) DO UPDATE SET content=EXCLUDED.content,updated_at=now(),expires_at=EXCLUDED.expires_at`);
  void db.execute(sql`UPDATE users SET last_active_at=now() WHERE id=${me} AND (last_active_at IS NULL OR last_active_at < now() - interval '60 seconds')`).then(() => {}, () => {}); return reply.status(201).send({ok:true});
 });
 app.delete('/messages/notes',{preHandler:verifyToken},async(request,reply)=>{const me=(request.user as {id:string}).id;await db.execute(sql`DELETE FROM user_notes WHERE user_id=${me}`);return reply.send({deleted:true});});
 app.post('/presence/ping',{preHandler:verifyToken},async(request,reply)=>{const me=(request.user as {id:string}).id;void db.execute(sql`UPDATE users SET last_active_at=now() WHERE id=${me} AND (last_active_at IS NULL OR last_active_at < now() - interval '60 seconds')`).then(() => {}, () => {});return reply.send({ok:true});});
 app.get('/presence/active',{preHandler:verifyToken},async(request,reply)=>{
  const me=(request.user as {id:string}).id; void db.execute(sql`UPDATE users SET last_active_at=now() WHERE id=${me} AND (last_active_at IS NULL OR last_active_at < now() - interval '60 seconds')`).then(() => {}, () => {});
  const rows=await db.execute(sql`SELECT u.id,u.username,u.display_name,u.avatar_url,u.verified_at,u.supporter_number,u.supporter_expires_at,(lower(u.email)=lower('sdmtr033@gmail.com')) AS is_founder,(u.last_active_at>now()-interval '5 minutes') AS is_active,n.content AS note,n.created_at AS note_created_at,n.expires_at AS note_expires_at FROM users u LEFT JOIN user_notes n ON n.user_id=u.id AND n.expires_at>now() WHERE u.id<>${me} AND u.last_active_at>now()-interval '5 minutes' AND (u.id IN (SELECT following_id FROM follows WHERE follower_id=${me} AND status='accepted') OR u.id IN (SELECT follower_id FROM follows WHERE following_id=${me} AND status='accepted') OR u.id IN (SELECT sender_id FROM messages WHERE receiver_id=${me}) OR u.id IN (SELECT receiver_id FROM messages WHERE sender_id=${me})) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${me} AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=${me})) ORDER BY u.last_active_at DESC LIMIT 30`);
  return reply.send({users:rows.rows.map((r:any)=>({id:r.id,username:r.username,displayName:r.display_name,avatarUrl:r.avatar_url,verifiedAt:r.verified_at,supporterNumber:r.supporter_number,supporterExpiresAt:r.supporter_expires_at,isFounder:Boolean(r.is_founder),isActive:Boolean(r.is_active),note:r.note||null,noteCreatedAt:r.note_created_at||null,noteExpiresAt:r.note_expires_at||null}))});
 });
 app.get('/messages',async(request,reply)=>{
  const auth=request.headers.authorization;
  const accept=String(request.headers.accept||'');
  if(!auth && accept.includes('text/html')) return reply.type('text/html').sendFile('index.html');
  try{await verifyToken(request,reply);}catch{return;}
  if(reply.sent)return;
  const me=(request.user as {id:string}).id;
  void db.execute(sql`UPDATE users SET last_active_at=now() WHERE id=${me} AND (last_active_at IS NULL OR last_active_at < now() - interval '60 seconds')`).then(() => {}, () => {});
  const result=await db.execute(sql`
    WITH latest_sent AS (
      SELECT DISTINCT ON (m.receiver_id)
        m.receiver_id AS other_id,m.id,m.content,m.created_at,m.sender_id,m.receiver_id
      FROM messages m
      WHERE m.sender_id=${me} AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${me} AND b.blocked_id=m.receiver_id) OR (b.blocker_id=m.receiver_id AND b.blocked_id=${me}))
      ORDER BY m.receiver_id,m.created_at DESC
    ),
    latest_received AS (
      SELECT DISTINCT ON (m.sender_id)
        m.sender_id AS other_id,m.id,m.content,m.created_at,m.sender_id,m.receiver_id
      FROM messages m
      WHERE m.receiver_id=${me} AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${me} AND b.blocked_id=m.sender_id) OR (b.blocker_id=m.sender_id AND b.blocked_id=${me}))
      ORDER BY m.sender_id,m.created_at DESC
    ),
    latest AS (
      SELECT DISTINCT ON (other_id)
        other_id,id,content,created_at,sender_id,receiver_id
      FROM (
        SELECT * FROM latest_sent
        UNION ALL
        SELECT * FROM latest_received
      ) x
      ORDER BY other_id,created_at DESC
    )
    SELECT l.other_id,l.id,l.content,l.created_at,l.sender_id,l.receiver_id,
           u.username,u.display_name,u.avatar_url,u.verified_at,u.supporter_number,u.supporter_expires_at,(lower(u.email)=lower('sdmtr033@gmail.com')) AS is_founder
    FROM latest l
    JOIN users u ON u.id=l.other_id
    ORDER BY l.created_at DESC
    LIMIT 50
  `);
  return {
    chats: result.rows.map((r:any)=>({
      user:{id:r.other_id,username:r.username,displayName:r.display_name,avatarUrl:r.avatar_url,verifiedAt:r.verified_at,supporterNumber:r.supporter_number,supporterExpiresAt:r.supporter_expires_at,isFounder:Boolean(r.is_founder)},
      messages:[{id:r.id,content:r.content,createdAt:r.created_at,senderId:r.sender_id,receiverId:r.receiver_id}]
    }))
  };
 });
 app.get('/messages/:username',{preHandler:verifyToken},async(request,reply)=>{const me=(request.user as {id:string}).id;const {username}=request.params as {username:string};const u=await db.execute(sql`SELECT id,username,display_name,avatar_url,verified_at,supporter_number,supporter_expires_at,(lower(email)=lower('sdmtr033@gmail.com')) AS is_founder FROM users WHERE lower(username)=lower(${username}) LIMIT 1`);const other=(u.rows[0] as any);if(!other)return reply.status(404).send({error:'USER_NOT_FOUND'});const [blocked,rows]=await Promise.all([db.execute(sql`SELECT 1 FROM blocks WHERE (blocker_id=${me} AND blocked_id=${other.id}) OR (blocker_id=${other.id} AND blocked_id=${me}) LIMIT 1`),db.execute(sql`SELECT id,content,created_at,sender_id,receiver_id FROM messages WHERE (sender_id=${me} AND receiver_id=${other.id}) OR (sender_id=${other.id} AND receiver_id=${me}) ORDER BY created_at DESC LIMIT 60`)]);if(blocked.rows[0])return reply.status(403).send({error:'USER_BLOCKED'});return {user:{id:other.id,username:other.username,displayName:other.display_name,avatarUrl:other.avatar_url,verifiedAt:other.verified_at,supporterNumber:other.supporter_number,supporterExpiresAt:other.supporter_expires_at,isFounder:Boolean(other.is_founder)},messages:rows.rows.reverse().map((r:any)=>({id:r.id,content:r.content,createdAt:r.created_at,senderId:r.sender_id,receiverId:r.receiver_id}))};});
 app.post('/messages/:username',{preHandler:verifyToken},async(request,reply)=>{const me=(request.user as {id:string}).id;void db.execute(sql`UPDATE users SET last_active_at=now() WHERE id=${me} AND (last_active_at IS NULL OR last_active_at < now() - interval '60 seconds')`).then(() => {}, () => {});const {username}=request.params as {username:string};const body=request.body as {content?:string};const content=body.content?.trim();if(!content)return reply.status(400).send({error:'VALIDATION_ERROR'});const u=await db.execute(sql`SELECT id FROM users WHERE lower(username)=lower(${username}) LIMIT 1`);const other=(u.rows[0] as any);if(!other)return reply.status(404).send({error:'USER_NOT_FOUND'});if(other.id===me)return reply.status(400).send({error:'CANNOT_MESSAGE_SELF'});const blocked=await db.execute(sql`SELECT 1 FROM blocks WHERE (blocker_id=${me} AND blocked_id=${other.id}) OR (blocker_id=${other.id} AND blocked_id=${me}) LIMIT 1`);if(blocked.rows[0])return reply.status(403).send({error:'USER_BLOCKED'});const result=await db.execute(sql`INSERT INTO messages(sender_id,receiver_id,content) VALUES(${me},${other.id},${content}) RETURNING id,content,created_at,sender_id,receiver_id`); void (async () => {
  const actor = await db.execute(sql`SELECT username FROM users WHERE id=${me} LIMIT 1`);
  const a: any = actor.rows[0];
  await (app as any).notifyUser(other.id, 'message', 'رسالة جديدة', `@${a?.username || 'مستخدم'} أرسل لك رسالة`, me, { actorId: me, url: '/messages?username=' + encodeURIComponent(a?.username || '') });
})().catch(() => {});
const r0: any = result.rows[0];
return reply.status(201).send({ message: { id: r0.id, content: r0.content, createdAt: r0.created_at, senderId: r0.sender_id, receiverId: r0.receiver_id } });});
}
