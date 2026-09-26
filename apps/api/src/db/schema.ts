import { pgTable, varchar, text, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content'),
    mediaUrl: text('media_url'),
    mediaType: varchar('media_type', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('posts_user_id_idx').on(table.userId),
    createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
  })
);

export const passwordResetCodes = pgTable(
  'password_reset_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    resetTokenHash: text('reset_token_hash'),
    expiresAt: timestamp('expires_at').notNull(),
    attempts: varchar('attempts', { length: 10 }).notNull().default('0'),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('password_reset_user_id_idx').on(table.userId),
    expiresAtIdx: index('password_reset_expires_at_idx').on(table.expiresAt),
  })
);


export const likes = pgTable(
  'likes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userPostUnique: uniqueIndex('likes_user_post_unique').on(
      table.userId,
      table.postId,
    ),
    userIdIdx: index('likes_user_id_idx').on(table.userId),
    postIdIdx: index('likes_post_id_idx').on(table.postId),
  }),
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    parentCommentId: uuid('parent_comment_id'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('comments_user_id_idx').on(table.userId),
    postIdIdx: index('comments_post_id_idx').on(table.postId),
    createdAtIdx: index('comments_created_at_idx').on(table.createdAt),
  }),
);
