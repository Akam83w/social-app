import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createPasswordResetCode,
  verifyPasswordResetCode,
  completePasswordReset,
} from './password-reset.service';

const requestResetSchema = z.object({
  email: z.string().email(),
});

const verifyResetCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export async function passwordResetRoutes(app: FastifyInstance) {
  app.post('/auth/password-reset/request', async (request, reply) => {
    const parsed = requestResetSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await createPasswordResetCode(parsed.data.email);

      if (result.code) {
        app.log.info(
          { email: parsed.data.email },
          'Password reset code generated'
        );
      }

      return reply.status(200).send({
        message: 'إذا كان الإيميل مسجلاً، سيتم إرسال رمز الاستعادة إليه.',
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });

  app.post('/auth/password-reset/complete', async (request, reply) => {
    const parsed = z.object({
      resetId: z.string().uuid(),
      resetToken: z.string().min(32),
      newPassword: z.string().min(8),
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    try {
      await completePasswordReset(
        parsed.data.resetId,
        parsed.data.resetToken,
        parsed.data.newPassword
      );

      return reply.status(200).send({
        message: 'تم تغيير كلمة المرور بنجاح.',
      });
    } catch (err: any) {
      if (err.message === 'INVALID_RESET') {
        return reply.status(400).send({
          error: 'INVALID_RESET',
        });
      }

      if (err.message === 'INVALID_PASSWORD') {
        return reply.status(400).send({
          error: 'INVALID_PASSWORD',
        });
      }

      app.log.error(err);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
      });
    }
  });


  app.post('/auth/password-reset/verify', async (request, reply) => {
    const parsed = verifyResetCodeSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await verifyPasswordResetCode(
        parsed.data.email,
        parsed.data.code
      );

      if (!result.valid) {
        return reply.status(400).send({
          error: 'INVALID_OR_EXPIRED_CODE',
        });
      }

      return reply.status(200).send({
        valid: true,
        resetId: result.resetId, resetToken: result.resetToken,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR' });
    }
  });
}
