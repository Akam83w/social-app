import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, desc, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../../db';
import { passwordResetCodes, users } from '../../db/schema';

function generateCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function createPasswordResetCode(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return { code: null };
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const now = new Date();

  await db
    .update(passwordResetCodes)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetCodes.userId, user.id),
        isNull(passwordResetCodes.usedAt),
        gt(passwordResetCodes.expiresAt, now)
      )
    );

  await db.insert(passwordResetCodes).values({
    userId: user.id,
    codeHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: '0',
  });

  return { code };
}

export async function verifyPasswordResetCode(
  email: string,
  code: string
) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return { valid: false };
  }

  const [reset] = await db
    .select()
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.userId, user.id),
        isNull(passwordResetCodes.usedAt),
        gt(passwordResetCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(passwordResetCodes.createdAt))
    .limit(1);

  if (!reset) {
    return { valid: false };
  }

  const attempts = Number(reset.attempts);

  if (attempts >= 5) {
    return { valid: false };
  }

  const matches = await bcrypt.compare(code, reset.codeHash);

  if (!matches) {
    await db
      .update(passwordResetCodes)
      .set({ attempts: String(attempts + 1) })
      .where(eq(passwordResetCodes.id, reset.id));

    return { valid: false };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  await db
    .update(passwordResetCodes)
    .set({ resetTokenHash })
    .where(eq(passwordResetCodes.id, reset.id));

  return {
    valid: true,
    resetId: reset.id,
    resetToken,
  };
}

export async function completePasswordReset(
  resetId: string,
  resetToken: string,
  newPassword: string
) {
  const [reset] = await db
    .select()
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.id, resetId),
        isNull(passwordResetCodes.usedAt),
        gt(passwordResetCodes.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!reset || !reset.resetTokenHash) {
    throw new Error('INVALID_RESET');
  }

  const resetTokenHash = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  if (resetTokenHash !== reset.resetTokenHash) {
    throw new Error('INVALID_RESET');
  }

  if (newPassword.length < 8) {
    throw new Error('INVALID_PASSWORD');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, reset.userId));

  await db
    .update(passwordResetCodes)
    .set({
      usedAt: new Date(),
      resetTokenHash: null,
    })
    .where(eq(passwordResetCodes.id, reset.id));

  return { success: true };
}
