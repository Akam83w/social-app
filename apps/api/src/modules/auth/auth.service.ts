import bcrypt from 'bcryptjs';
import { eq, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import type { RegisterInput, LoginInput } from './auth.schema';

export async function registerUser(input: RegisterInput) {
  const username = input.username.trim().toLowerCase();
  const conditions = [eq(users.email, input.email), sql`lower(${users.username}) = ${username}`];
  if (input.phone) {
    conditions.push(eq(users.phone, input.phone));
  }

  const existing = await db
    .select()
    .from(users)
    .where(or(...conditions))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('USER_ALREADY_EXISTS');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const nextSupporter = await db.execute<{ next_number: string }>(sql`SELECT nextval('supporter_number_seq')::text AS next_number`);
  const supporterNumber = Number(nextSupporter.rows[0]?.next_number ?? 999999);
  const createdAt = new Date();
  const supporter = supporterNumber <= 1932 ? supporterNumber : null;
  const supporterExpiresAt = supporter ? new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000) : null;

  const [newUser] = await db
    .insert(users)
    .values({
      username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      displayName: input.displayName,
      supporterNumber: supporter ? String(supporter) : null,
      supporterExpiresAt,
      verifiedAt: null,
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      phone: users.phone,
      displayName: users.displayName,
      createdAt: users.createdAt,
      supporterNumber: users.supporterNumber,
      supporterExpiresAt: users.supporterExpiresAt,
      verifiedAt: users.verifiedAt,
    });

  return newUser;
}

export async function loginUser(input: LoginInput) {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.email, input.identifier),
        sql`lower(${users.username}) = lower(${input.identifier})`,
        eq(users.phone, input.identifier)
      )
    )
    .limit(1);

  if (!existingUser) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const passwordMatches = await bcrypt.compare(input.password, existingUser.passwordHash);

  if (!passwordMatches) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return {
    id: existingUser.id,
    username: existingUser.username,
    email: existingUser.email,
    displayName: existingUser.displayName,
    phone: existingUser.phone,
    bio: existingUser.bio,
    avatarUrl: existingUser.avatarUrl,
    supporterNumber: existingUser.supporterNumber,
    supporterExpiresAt: existingUser.supporterExpiresAt,
    verifiedAt: existingUser.verifiedAt,
    moderationStatus: existingUser.moderationStatus,
    suspendedUntil: existingUser.suspendedUntil,
    moderationStrikes: Number(existingUser.moderationStrikes || 0),
  };
}


export async function updateUserAvatar(userId: string, avatarUrl: string | null) {
  const [updatedUser] = await db
    .update(users)
    .set({
      avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    });

  if (!updatedUser) {
    throw new Error('USER_NOT_FOUND');
  }

  return updatedUser;
}
