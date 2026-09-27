import { sql } from 'drizzle-orm';
import { db } from '../db';

type ModerationDecision = {
  flagged: boolean;
  reason?: string;
  severity: 'low' | 'high';
};

function dataUrlToBase64(value: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(value);
  return match ? { mime: match[1], base64: match[2] } : null;
}

async function checkImage(mediaUrl: string): Promise<ModerationDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('MODERATION_NOT_CONFIGURED');
  const parsed = dataUrlToBase64(mediaUrl);
  if (!parsed) throw new Error('MODERATION_UNSUPPORTED_MEDIA');

  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: [{
        type: 'image_url',
        image_url: { url: mediaUrl },
      }],
    }),
  });
  if (!response.ok) throw new Error('MODERATION_PROVIDER_ERROR');
  const data = await response.json() as any;
  const result = data?.results?.[0];
  const categories = result?.categories || {};
  const scores = result?.category_scores || {};
  const sexual = Number(scores.sexual || 0);
  const sexualMinors = Number(scores['sexual/minors'] || 0);

  if (Boolean(categories['sexual/minors']) || sexualMinors >= 0.01) {
    return { flagged: true, severity: 'high', reason: 'sexual/minors' };
  }
  if (Boolean(categories.sexual) || sexual >= 0.72) {
    return { flagged: true, severity: sexual >= 0.9 ? 'high' : 'low', reason: 'sexual' };
  }
  return { flagged: false, severity: 'low' };
}

export async function moderateMedia(mediaUrl: string, mediaType: string): Promise<ModerationDecision> {
  if (mediaType === 'image') return checkImage(mediaUrl);
  if (mediaType === 'video') throw new Error('MODERATION_VIDEO_NOT_SUPPORTED');
  return { flagged: false, severity: 'low' };
}

export async function registerModerationViolation(
  userId: string,
  targetType: string,
  targetId: string | null,
  decision: ModerationDecision,
) {
  const current = await db.execute<{ moderation_strikes: string }>(
    sql`SELECT moderation_strikes FROM users WHERE id=${userId} FOR UPDATE`,
  );
  const strikes = Number(current.rows[0]?.moderation_strikes || 0) + 1;

  let action = 'warning';
  let suspendedUntil: Date | null = null;
  let status = 'active';

  if (decision.severity === 'high') {
    action = 'account_suspended';
    status = 'suspended';
    suspendedUntil = null;
  } else if (strikes >= 5) {
    action = 'account_suspended';
    status = 'suspended';
    suspendedUntil = null;
  } else if (strikes === 4) {
    action = 'suspend_7d';
    status = 'suspended';
    suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  } else if (strikes === 3) {
    action = 'suspend_24h';
    status = 'suspended';
    suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else if (strikes === 2) {
    action = 'final_warning';
  }

  await db.execute(sql`UPDATE users SET moderation_strikes=${String(strikes)}, suspended_until=${suspendedUntil}, moderation_status=${status}, updated_at=now() WHERE id=${userId}`);
  await db.execute(sql`INSERT INTO moderation_violations(user_id,target_id,target_type,violation_type,severity,action,reason) VALUES(${userId},${targetId},${targetType},'nudity',${decision.severity},${action},${decision.reason || 'sexual content'})`);

  return { strikes, action, suspendedUntil, status };
}

export async function ensureAccountActive(userId: string) {
  const result = await db.execute<{ moderation_status: string; suspended_until: Date | null }>(
    sql`SELECT moderation_status,suspended_until FROM users WHERE id=${userId} LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return;
  if (row.suspended_until && new Date(row.suspended_until).getTime() <= Date.now()) {
    await db.execute(sql`UPDATE users SET moderation_status='active', suspended_until=NULL, updated_at=now() WHERE id=${userId}`);
    return;
  }
  if (row.moderation_status === 'suspended') {
    throw new Error('ACCOUNT_SUSPENDED');
  }
}
