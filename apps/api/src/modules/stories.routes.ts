import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { verifyToken } from '../middleware/auth.middleware';
import { isAllowedMediaUrl } from '../services/media-url';
import { moderateMedia, registerModerationViolation } from '../services/moderation.service';

export async function storiesRoutes(app:FastifyInstance){
 app.post('/stories',{preHandler:verifyToken},async(request,reply)=>{
   const me=(request.user as {id:string}).id;
   const body=request.body as {mediaUrl?:string;mediaType?:string;content?:string};
   if(!body.mediaUrl||body.mediaType!=='image')return reply.status(400).send({error:'IMAGE_ONLY_FOR_NOW'});
   if(!isAllowedMediaUrl(body.mediaUrl))return reply.status(400).send({error:'INVALID_MEDIA_URL'});
   let decision;
   try{decision=await moderateMedia(body.mediaUrl,'image')}
   catch(err){return reply.status(503).send({error:err instanceof Error?err.message:'MODERATION_UNAVAILABLE'})}
   if(decision.flagged){
     const enforcement=await registerModerationViolation(me,'story',null,decision);
     try{await (app as any).notifyUser(me,'moderation','تم رفض القصة',enforcement.action==='warning'?'تم رفض المحتوى لأنه يخالف إرشادات SDM.':'تم رفض المحتوى وتم تطبيق إجراء على الحساب بسبب تكرار المخالفات.',me,{url:'/profile/settings'})}catch{}
     return reply.status(422).send({error:'CONTENT_REJECTED',action:enforcement.action,strikes:enforcement.strikes});
   }
   const r=await db.execute(sql`INSERT INTO stories(user_id,media_url,media_type,content,expires_at) VALUES(${me},${body.mediaUrl},'image',${body.content?.trim()||null},now()+interval '24 hours') RETURNING id,media_url,media_type,content,created_at,expires_at`);
   return reply.status(201).send({story:r.rows[0]});
 });
 app.get('/stories',async(request,reply)=>{
  const auth=request.headers.authorization; const accept=String(request.headers.accept||'');
  if(!auth && accept.includes('text/html')) return reply.type('text/html').sendFile('index.html');
  try{await verifyToken(request,reply)}catch{return} if(reply.sent)return;
  const me=(request.user as {id:string}).id;
  const r=await db.execute(sql`SELECT s.id,s.media_url,s.media_type,s.media_poster,s.content,s.created_at,s.expires_at,u.id AS user_id,u.username,u.display_name,u.avatar_url FROM stories s JOIN users u ON u.id=s.user_id WHERE s.expires_at>now() AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${me} AND b.blocked_id=s.user_id) OR (b.blocker_id=s.user_id AND b.blocked_id=${me})) ORDER BY s.created_at DESC LIMIT 30`);
  return {stories:r.rows};
 });
}
