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
  supporterNumber: varchar('supporter_number', { length: 10 }),
  supporterExpiresAt: timestamp('supporter_expires_at'),
  verifiedAt: timestamp('verified_at'),
  moderationStrikes: varchar('moderation_strikes', { length: 10 }).notNull().default('0'),
  suspendedUntil: timestamp('suspended_until'),
  moderationStatus: varchar('moderation_status', { length: 20 }).notNull().default('active'),
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


export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  reporterIdx: index('reports_reporter_idx').on(table.reporterId),
  targetIdx: index('reports_target_idx').on(table.targetType, table.targetId),
}));

export const blocks = pgTable('blocks', {
  blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pairUnique: uniqueIndex('blocks_pair_unique').on(table.blockerId, table.blockedId),
  blockerIdx: index('blocks_blocker_idx').on(table.blockerId),
  blockedIdx: index('blocks_blocked_idx').on(table.blockedId),
}));

export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pairUnique: uniqueIndex('follows_pair_unique').on(table.followerId, table.followingId),
    followerIdx: index('follows_follower_idx').on(table.followerId),
    followingIdx: index('follows_following_idx').on(table.followingId),
  }),
);


export const moderationViolations = pgTable('moderation_violations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id'),
  targetType: varchar('target_type', { length: 20 }).notNull(),
  violationType: varchar('violation_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  action: varchar('action', { length: 30 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('moderation_violations_user_idx').on(table.userId),
  createdIdx: index('moderation_violations_created_idx').on(table.createdAt),
}));
