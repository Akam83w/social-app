import { redisExpire, redisIncr } from './redis.service';

export async function allowAction(scope: string, subject: string, limit: number, windowSeconds: number) {
  const key=`abuse:${scope}:${subject}`;
  const count=Number(await redisIncr(key));
  if(count===1) await redisExpire(key,windowSeconds);
  return count<=limit;
}

export async function requireAction(scope: string, subject: string, limit: number, windowSeconds: number) {
  const allowed=await allowAction(scope,subject,limit,windowSeconds);
  if(!allowed) throw new Error('RATE_LIMITED');
}
