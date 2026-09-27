import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { comments, likes, posts, users } from '../../db/schema';
import type { CreatePostInput } from './posts.schema';

export async function createPost(userId: string, input: CreatePostInput) {
  const [newPost] = await db
    .insert(posts)
    .values({
      userId,
      content: input.content || null,
      mediaUrl: input.mediaUrl || null,
      mediaType: input.mediaType || null,
    })
    .returning();

  return newPost;
}

export async function getPosts(currentUserId?: string, limit = 20, cursor?: string) {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      mediaUrl: posts.mediaUrl,
      mediaType: posts.mediaType,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        supporterNumber: users.supporterNumber,
        supporterExpiresAt: users.supporterExpiresAt,
        verifiedAt: users.verifiedAt,
        isFounder: sql<boolean>`lower(${users.email}) = lower('sdmtr033@gmail.com')`,
      },
      likeCount: sql<number>`(SELECT count(*)::int FROM likes WHERE likes.post_id = ${posts.id})`,
      likedByMe: currentUserId
        ? sql<boolean>`EXISTS (SELECT 1 FROM likes WHERE likes.post_id = ${posts.id} AND likes.user_id = ${currentUserId})`
        : sql<boolean>`false`,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(cursor ? sql`${posts.createdAt} < ${new Date(cursor)}` : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function getPostsByHashtag(currentUserId: string, tag: string, limit = 50) {
  const cleanTag = tag.trim().replace(/^#/, '').toLowerCase();
  return db
    .select({
      id: posts.id,
      content: posts.content,
      mediaUrl: posts.mediaUrl,
      mediaType: posts.mediaType,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      user: { id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, supporterNumber: users.supporterNumber, supporterExpiresAt: users.supporterExpiresAt, verifiedAt: users.verifiedAt, isFounder: sql<boolean>`lower(${users.email}) = lower('sdmtr033@gmail.com')` },
      likeCount: sql<number>`(SELECT count(*)::int FROM likes WHERE likes.post_id = ${posts.id})`,
      likedByMe: sql<boolean>`EXISTS (SELECT 1 FROM likes WHERE likes.post_id = ${posts.id} AND likes.user_id = ${currentUserId})`,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(sql`lower(coalesce(${posts.content}, '')) ~ ${`(^|[^[:alnum:]_])#${cleanTag}([^[:alnum:]_]|$)`}`)
    .orderBy(desc(posts.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function getPostById(postId: string) {
  const [post] = await db
    .select({
      id: posts.id,
      content: posts.content,
      mediaUrl: posts.mediaUrl,
      mediaType: posts.mediaType,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        supporterNumber: users.supporterNumber,
        supporterExpiresAt: users.supporterExpiresAt,
        verifiedAt: users.verifiedAt,
        isFounder: sql<boolean>`lower(${users.email}) = lower('sdmtr033@gmail.com')`,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);

  return post;
}


export async function likePost(userId: string, postId: string) {
  const [like] = await db
    .insert(likes)
    .values({
      userId,
      postId,
    })
    .onConflictDoNothing({
      target: [likes.userId, likes.postId],
    })
    .returning();

  return like ?? null;
}

export async function deletePost(userId: string, postId: string) {
  const result = await db
    .delete(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));

  return result.rowCount ?? 0;
}

export async function unlikePost(userId: string, postId: string) {
  const result = await db
    .delete(likes)
    .where(
      and(
        eq(likes.userId, userId),
        eq(likes.postId, postId),
      ),
    );

  return result.rowCount ?? 0;
}

export async function getPostLikeStatus(userId: string, postId: string) {
  const [result] = await db
    .select({
      likeCount: sql<number>`count(${likes.id})::int`,
      likedByMe: sql<boolean>`coalesce(bool_or(${likes.userId} = ${userId}), false)`,
    })
    .from(likes)
    .where(eq(likes.postId, postId));

  return result;
}


export async function getPostComments(postId: string) {
  return db
    .select({
      id: comments.id,
      parentCommentId: comments.parentCommentId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt));
}

export async function getCommentById(commentId: string) {
  const [comment] = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      parentCommentId: comments.parentCommentId,
    })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  return comment;
}

export async function createComment(
  userId: string,
  postId: string,
  content: string,
  parentCommentId?: string | null,
) {
  const [comment] = await db
    .insert(comments)
    .values({
      userId,
      postId,
      content,
      parentCommentId: parentCommentId || null,
    })
    .returning();

  return comment;
}

export async function deleteComment(
  userId: string,
  commentId: string,
) {
  const result = await db
    .delete(comments)
    .where(
      and(
        eq(comments.id, commentId),
        eq(comments.userId, userId),
      ),
    );

  return result.rowCount ?? 0;
}
