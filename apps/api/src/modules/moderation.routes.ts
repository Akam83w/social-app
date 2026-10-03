import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { verifyToken } from '../middleware/auth.middleware';
import { z } from 'zod';

const reportDecisionSchema = z.object({
  decision: z.enum(['dismiss', 'warn', 'suspend_24h', 'suspend_7d', 'suspend_permanent', 'remove_content']),
  note: z.string().trim().max(2000).optional(),
});

const appealDecisionSchema = z.object({
  decision: z.enum(['accept', 'reject']),
  note: z.string().trim().max(2000).optional(),
});

function moderatorEmails() {
  return new Set(
    [process.env.FOUNDER_EMAIL || 'sdmtr033@gmail.com', ...(process.env.MODERATOR_EMAILS || '').split(',')]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean),
  );
}

async function requireModerator(request: any, reply: any) {
  const me = (request.user as { id: string }).id;
  const result = await db.execute(sql`SELECT email FROM users WHERE id=${me} LIMIT 1`);
  const email = String((result.rows[0] as any)?.email || '').trim().toLowerCase();
  if (!email || !moderatorEmails().has(email)) {
    return reply.status(403).send({ error: 'MODERATOR_REQUIRED' });
  }
}

export async function moderationRoutes(app: FastifyInstance) {
  app.get('/moderation/reports', { preHandler: [verifyToken, requireModerator] }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const status = ['pending', 'resolved', 'dismissed'].includes(String(query.status || 'pending'))
      ? String(query.status || 'pending')
      : 'pending';
    const result = await db.execute(sql`
      SELECT r.id,r.target_id,r.target_type,r.reason,r.status,r.decision,r.moderator_note,r.created_at,r.resolved_at,
             reporter.id AS reporter_id,reporter.username AS reporter_username,
             target_user.id AS target_user_id,target_user.username AS target_username,target_user.moderation_status,target_user.moderation_strikes
      FROM reports r
      JOIN users reporter ON reporter.id=r.reporter_id
      LEFT JOIN users target_user ON r.target_type='user' AND target_user.id=r.target_id
      WHERE r.status=${status}
      ORDER BY r.created_at ASC
      LIMIT 100
    `);
    return reply.send({ reports: result.rows });
  });

  app.patch('/moderation/reports/:id', { preHandler: [verifyToken, requireModerator] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reportDecisionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_MODERATION_DECISION', details: parsed.error.flatten() });

    const report = await db.execute(sql`SELECT id,target_id,target_type,status FROM reports WHERE id=${id} LIMIT 1`);
    const row = report.rows[0] as any;
    if (!row) return reply.status(404).send({ error: 'REPORT_NOT_FOUND' });
    if (row.status !== 'pending') return reply.status(409).send({ error: 'REPORT_ALREADY_RESOLVED' });

    const moderatorId = (request.user as { id: string }).id;
    const decision = parsed.data.decision;
    const note = parsed.data.note || null;

    if (decision === 'remove_content' && row.target_type === 'post') {
      await db.execute(sql`DELETE FROM posts WHERE id=${row.target_id}`);
    }

    if (['warn', 'suspend_24h', 'suspend_7d', 'suspend_permanent'].includes(decision) && row.target_type === 'user') {
      const duration = decision === 'suspend_24h'
        ? sql`now()+interval '24 hours'`
        : decision === 'suspend_7d'
          ? sql`now()+interval '7 days'`
          : sql`NULL`;
      const status = decision === 'warn' ? 'active' : 'suspended';
      await db.execute(sql`UPDATE users SET moderation_strikes=(COALESCE(NULLIF(moderation_strikes,''),'0')::int+1)::text, moderation_status=${status}, suspended_until=${duration}, updated_at=now() WHERE id=${row.target_id}`);
      await db.execute(sql`INSERT INTO moderation_violations(user_id,target_id,target_type,violation_type,severity,action,reason) VALUES(${row.target_id},${row.target_id},'user','report','low',${decision},${note || row.target_type})`);
    }

    await db.execute(sql`UPDATE reports SET status=${decision === 'dismiss' ? 'dismissed' : 'resolved'},moderator_id=${moderatorId},decision=${decision},moderator_note=${note},resolved_at=now() WHERE id=${id}`);
    return reply.send({ resolved: true });
  });

  app.get('/moderation/appeals', { preHandler: [verifyToken, requireModerator] }, async (_request, reply) => {
    const result = await db.execute(sql`
      SELECT a.id,a.user_id,a.reason,a.status,a.decision,a.moderator_note,a.created_at,a.resolved_at,
             u.username,u.email,u.moderation_status,u.moderation_strikes,u.suspended_until
      FROM moderation_appeals a
      JOIN users u ON u.id=a.user_id
      WHERE a.status='pending'
      ORDER BY a.created_at ASC
      LIMIT 100
    `);
    return reply.send({ appeals: result.rows });
  });

  app.patch('/moderation/appeals/:id', { preHandler: [verifyToken, requireModerator] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = appealDecisionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_APPEAL_DECISION', details: parsed.error.flatten() });

    const appeal = await db.execute(sql`SELECT id,user_id,status FROM moderation_appeals WHERE id=${id} LIMIT 1`);
    const row = appeal.rows[0] as any;
    if (!row) return reply.status(404).send({ error: 'APPEAL_NOT_FOUND' });
    if (row.status !== 'pending') return reply.status(409).send({ error: 'APPEAL_ALREADY_RESOLVED' });

    const moderatorId = (request.user as { id: string }).id;
    const decision = parsed.data.decision;
    await db.execute(sql`UPDATE moderation_appeals SET status='resolved',decision=${decision},moderator_note=${parsed.data.note || null},moderator_id=${moderatorId},resolved_at=now() WHERE id=${id}`);
    if (decision === 'accept') {
      await db.execute(sql`UPDATE users SET moderation_status='active',suspended_until=NULL,updated_at=now() WHERE id=${row.user_id}`);
    }
    return reply.send({ resolved: true });
  });
}
