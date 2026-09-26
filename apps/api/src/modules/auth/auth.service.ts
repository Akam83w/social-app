import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import type { RegisterInput, LoginInput } from './auth.schema';

export async function registerUser(input: RegisterInput) {
  const conditions = [eq(users.email, input.email), eq(users.username, input.username)];
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

  const [newUser] = await db
    .insert(users)
    .values({
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      displayName: input.displayName,
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      phone: users.phone,
      displayName: users.displayName,
      createdAt: users.createdAt,
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
        eq(users.username, input.identifier),
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
    avatarUrl: existingUser.avatarUrl,
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
