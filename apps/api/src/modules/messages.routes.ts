import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { verifyToken } from '../middleware/auth.middleware';

export async function messagesRoutes(app: FastifyInstance){
 app.get('/messages',async(request,reply)=>{
  const auth=request.headers.authorization;
  const accept=String(request.headers.accept||'');
  if(!auth && accept.includes('text/html')) return reply.type('text/html').sendFile('index.html');
  try{await verifyToken(request,reply);}catch{return;}
  if(reply.sent)return;
  const me=(request.user as {id:string}).id;
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
 app.get('/messages/:username',{preHandler:verifyToken},async(request,reply)=>{const me=(request.user as {id:string}).id;const {username}=request.params as {username:string};const u=await db.execute(sql`SELECT id,username,display_name,avatar_url,verified_at,supporter_number,supporter_expires_at,(lower(email)=lower('sdmtr033@gmail.com')) AS is_founder FROM users WHERE lower(username)=lower(${username}) LIMIT 1`);const other=(u.rows[0] as any);if(!other)return reply.status(404).send({error:'USER_NOT_FOUND'});const blocked=await db.execute(sql`SELECT 1 FROM blocks WHERE (blocker_id=${me} AND blocked_id=${other.id}) OR (blocker_id=${other.id} AND blocked_id=${me}) LIMIT 1`);if(blocked.rows[0])return reply.status(403).send({error:'USER_BLOCKED'});const rows=await db.execute(sql`
  SELECT id,content,created_at,sender_id,receiver_id
  FROM (
    SELECT id,content,created_at,sender_id,receiver_id
    FROM messages
    WHERE sender_id=${me} AND receiver_id=${other.id}
    UNION ALL
    SELECT id,content,created_at,sender_id,receiver_id
    FROM messages
    WHERE sender_id=${other.id} AND receiver_id=${me}
  ) x
  ORDER BY created_at DESC
  LIMIT 200
  `);return {user:{id:other.id,username:other.username,displayName:other.display_name,avatarUrl:other.avatar_url,verifiedAt:other.verified_at,supporterNumber:other.supporter_number,supporterExpiresAt:other.supporter_expires_at,isFounder:Boolean(other.is_founder)},messages:rows.rows.reverse().map((r:any)=>({id:r.id,content:r.content,createdAt:r.created_at,senderId:r.sender_id,receiverId:r.receiver_id}))};});
 app.post('/messages/:username',{preHandler:verifyToken},async(request,reply)=>{const me=(request.user as {id:string}).id;const {username}=request.params as {username:string};const body=request.body as {content?:string};const content=body.content?.trim();if(!content)return reply.status(400).send({error:'VALIDATION_ERROR'});const u=await db.execute(sql`SELECT id FROM users WHERE lower(username)=lower(${username}) LIMIT 1`);const other=(u.rows[0] as any);if(!other)return reply.status(404).send({error:'USER_NOT_FOUND'});if(other.id===me)return reply.status(400).send({error:'CANNOT_MESSAGE_SELF'});const blocked=await db.execute(sql`SELECT 1 FROM blocks WHERE (blocker_id=${me} AND blocked_id=${other.id}) OR (blocker_id=${other.id} AND blocked_id=${me}) LIMIT 1`);if(blocked.rows[0])return reply.status(403).send({error:'USER_BLOCKED'});const result=await db.execute(sql`INSERT INTO messages(sender_id,receiver_id,content) VALUES(${me},${other.id},${content}) RETURNING id,content,created_at,sender_id,receiver_id`); const actor=await db.execute(sql`SELECT username,display_name FROM users WHERE id=${me} LIMIT 1`); const a:any=actor.rows[0]; await (app as any).notifyUser(other.id,'message','رسالة جديدة',`@${a?.username||"مستخدم"} أرسل لك رسالة`,me,{actorId:me,url:'/messages?username='+encodeURIComponent(a?.username||'')}); return reply.status(201).send({message:result.rows[0]});});
}
