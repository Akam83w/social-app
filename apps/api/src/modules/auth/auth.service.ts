import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { eq, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import type { RegisterInput, LoginInput } from './auth.schema';

export async function registerUser(input: RegisterInput) {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || undefined;
  if (input.password !== input.passwordConfirmation) throw new Error('PASSWORD_MISMATCH');
  const conditions = [eq(users.email, email), sql`lower(${users.username}) = ${username}`];
  if (phone) {
    conditions.push(eq(users.phone, phone));
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
  const isFounder = email === 'sdmtr033@gmail.com';
  const supporter = isFounder ? null : supporterNumber;
  const supporterExpiresAt = supporter ? new Date(createdAt.getTime() + 60 * 24 * 60 * 60 * 1000) : null;
  const verifiedAt = isFounder || supporter ? createdAt : null;

  const [newUser] = await db
    .insert(users)
    .values({
      username,
      email,
      phone,
      passwordHash,
      displayName: input.displayName,
      supporterNumber: supporter ? String(supporter) : null,
      supporterExpiresAt,
      verifiedAt,
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


export async function loginWithOAuth(input: { accessToken: string; provider: 'facebook' | 'twitter'; username?: string; phone?: string }) {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseKey) throw new Error('OAUTH_SERVER_NOT_CONFIGURED');

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${input.accessToken}` },
  });
  if (!response.ok) throw new Error('OAUTH_INVALID_TOKEN');
  const remote = await response.json() as { email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };
  const email = String(remote.email || '').trim().toLowerCase();
  if (!email) throw new Error('OAUTH_EMAIL_REQUIRED');

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return { user: { id: existing.id, username: existing.username, email: existing.email, displayName: existing.displayName, phone: existing.phone, bio: existing.bio, avatarUrl: existing.avatarUrl, supporterNumber: existing.supporterNumber, supporterExpiresAt: existing.supporterExpiresAt, verifiedAt: existing.verifiedAt, moderationStatus: existing.moderationStatus, isPrivate: existing.isPrivate }, needsProfile: false };
  }

  const username = input.username?.trim().replace(/^@/, '').toLowerCase() || '';
  if (!/^[a-z0-9_.]{2,30}$/.test(username)) return { needsProfile: true };
  const [usernameOwner] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = ${username}`).limit(1);
  if (usernameOwner) throw new Error('USERNAME_TAKEN');
  const phone = input.phone?.trim() || undefined;
  if (phone) {
    const [phoneOwner] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    if (phoneOwner) throw new Error('PHONE_TAKEN');
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const nextSupporter = await db.execute<{ next_number: string }>(sql`SELECT nextval('supporter_number_seq')::text AS next_number`);
  const supporterNumber = Number(nextSupporter.rows[0]?.next_number ?? 999999);
  const createdAt = new Date();
  const supporter = email === 'sdmtr033@gmail.com' ? null : supporterNumber;
  const [newUser] = await db.insert(users).values({
    username, email, phone, passwordHash,
    displayName: String(remote.user_metadata?.full_name || remote.user_metadata?.name || '').trim() || null,
    supporterNumber: supporter ? String(supporter) : null,
    supporterExpiresAt: supporter ? new Date(createdAt.getTime() + 60 * 24 * 60 * 60 * 1000) : null,
    verifiedAt: createdAt,
  }).returning({ id: users.id, username: users.username, email: users.email, phone: users.phone, displayName: users.displayName, supporterNumber: users.supporterNumber, supporterExpiresAt: users.supporterExpiresAt, verifiedAt: users.verifiedAt, moderationStatus: users.moderationStatus, isPrivate: users.isPrivate });

  return { user: newUser, needsProfile: false };
}


export async function loginUser(input: LoginInput) {
  const identifier = input.identifier.trim();
  const [existingUser] = await db
    .select()
    .from(users)
    .where(
      or(
        sql`lower(${users.email}) = lower(${identifier})`,
        sql`lower(${users.username}) = lower(${input.identifier})`,
        eq(users.phone, identifier)
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
      isPrivate: existingUser.isPrivate,
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
