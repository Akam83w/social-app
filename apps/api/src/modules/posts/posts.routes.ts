import type { FastifyInstance } from 'fastify';
import { verifyToken } from '../../middleware/auth.middleware';
import { createPostSchema } from './posts.schema';
import {
  getPostLikeStatus,
  createPost,
  getPostById,
  getPosts,
  getPostComments,
  getCommentById,
  createComment,
  deleteComment,
  likePost,
  unlikePost,
  deletePost,
} from './posts.service';

export async function postsRoutes(app: FastifyInstance) {
  app.post('/posts', { preHandler: verifyToken }, async (request, reply) => {
    const parsed = createPostSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    try {
      const payload = request.user as { id: string };

      const post = await createPost(payload.id, parsed.data);

      return reply.status(201).send({ post });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const result = await getPosts(payload.id);

      return reply.status(200).send({
        posts: result,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts/:id/like', { preHandler: verifyToken }, async (request, reply) => {
    const user = request.user as { id: string };
    const { id } = request.params as { id: string };

    const result = await getPostLikeStatus(user.id, id);

    return reply.send(result);
  });

  app.post('/posts/:id/like', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };

      await likePost(payload.id, id);

      return reply.status(200).send({
        liked: true,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.delete('/posts/:id', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };
      const deleted = await deletePost(payload.id, id);
      if (!deleted) return reply.status(404).send({ error: 'POST_NOT_FOUND' });
      return reply.status(200).send({ deleted: true });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.delete('/posts/:id/like', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };

      await unlikePost(payload.id, id);

      return reply.status(200).send({
        liked: false,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts/:id/comments', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await getPostComments(id);

      return reply.status(200).send({
        comments: result,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.post('/posts/:id/comments', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };
      const body = request.body as {
        content?: string;
        parentCommentId?: string;
      };

      const content = body.content?.trim();

      if (!content) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
        });
      }

      if (body.parentCommentId) {
        const parentComment = await getCommentById(body.parentCommentId);

        if (!parentComment || parentComment.postId !== id) {
          return reply.status(400).send({
            error: 'INVALID_PARENT_COMMENT',
          });
        }
      }

      const comment = await createComment(
        payload.id,
        id,
        content,
        body.parentCommentId,
      );

      return reply.status(201).send({
        comment,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.delete('/comments/:id', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const payload = request.user as { id: string };
      const { id } = request.params as { id: string };

      const deleted = await deleteComment(payload.id, id);

      if (!deleted) {
        return reply.status(404).send({
          error: 'COMMENT_NOT_FOUND',
        });
      }

      return reply.status(200).send({
        deleted: true,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.get('/posts/:id', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const post = await getPostById(id);

    if (!post) {
      return reply.status(404).send({
        error: 'POST_NOT_FOUND',
      });
    }

    return reply.status(200).send({ post });
  });
}
