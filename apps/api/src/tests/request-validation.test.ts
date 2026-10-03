import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerSchema,
  loginSchema,
  oauthExchangeSchema,
  changePasswordSchema,
  authSettingsSchema,
} from '../modules/auth/auth.schema';
import {
  noteSchema,
  messageSchema,
  callStartSchema,
  callSignalSchema,
  storyImageSchema,
  videoUploadSchema,
  videoCompleteSchema,
  reportSchema,
  moderationAppealSchema,
  performanceSchema,
} from '../modules/request.schemas';

test('auth validation rejects weak and malformed credentials', () => {
  assert.equal(registerSchema.safeParse({ username: 'x', email: 'bad', password: '123', passwordConfirmation: '123' }).success, false);
  assert.equal(loginSchema.safeParse({ identifier: 'a', password: '' }).success, false);
  assert.equal(loginSchema.safeParse({ identifier: 'user@example.com', password: 'correct' }).success, true);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: '12345678' }).success, true);
});

test('oauth validation only accepts supported providers and bounded input', () => {
  assert.equal(oauthExchangeSchema.safeParse({ accessToken: 'token', provider: 'facebook' }).success, true);
  assert.equal(oauthExchangeSchema.safeParse({ accessToken: 'token', provider: 'google' }).success, false);
  assert.equal(oauthExchangeSchema.safeParse({ accessToken: '', provider: 'twitter' }).success, false);
});

test('settings validation rejects unknown values', () => {
  assert.equal(authSettingsSchema.safeParse({ allowMessages: 'everyone', notifyLikes: true }).success, true);
  assert.equal(authSettingsSchema.safeParse({ allowMessages: 'anyone' }).success, false);
});

test('messages and notes are bounded', () => {
  assert.equal(noteSchema.safeParse({ content: 'ملاحظة قصيرة' }).success, true);
  assert.equal(noteSchema.safeParse({ content: 'x'.repeat(61) }).success, false);
  assert.equal(messageSchema.safeParse({ content: 'hello' }).success, true);
  assert.equal(messageSchema.safeParse({ content: '' }).success, false);
  assert.equal(messageSchema.safeParse({ content: 'x'.repeat(2001) }).success, false);
});

test('calls require UUID peers and a valid call id', () => {
  assert.equal(callStartSchema.safeParse({ toUserId: 'not-a-uuid', video: true }).success, false);
  const id='00000000-0000-0000-0000-000000000001';
  assert.equal(callStartSchema.safeParse({ toUserId: id, video: true }).success, true);
  assert.equal(callSignalSchema.safeParse({ toUserId: id, kind: 'offer', payload: { callId: id } }).success, true);
  assert.equal(callSignalSchema.safeParse({ toUserId: id, kind: 'offer', payload: { callId: 'bad' } }).success, false);
});

test('stories and videos enforce media contracts', () => {
  assert.equal(storyImageSchema.safeParse({ mediaUrl: 'https://example.com/a.jpg', mediaType: 'image' }).success, true);
  assert.equal(storyImageSchema.safeParse({ mediaUrl: 'javascript:alert(1)', mediaType: 'image' }).success, false);
  assert.equal(videoUploadSchema.safeParse({ contentType: 'video/mp4', extension: 'mp4', size: 1024 }).success, true);
  assert.equal(videoUploadSchema.safeParse({ contentType: 'image/png', extension: 'png', size: 1024 }).success, false);
  assert.equal(videoUploadSchema.safeParse({ contentType: 'video/mp4', extension: 'mp4', size: 101 * 1024 * 1024 }).success, false);
  assert.equal(videoCompleteSchema.safeParse({ objectName: 'videos/u/originals/a.mp4' }).success, true);
});

test('reports and moderation appeals are bounded and typed', () => {
  const id='00000000-0000-0000-0000-000000000001';
  assert.equal(reportSchema.safeParse({ targetId: id, targetType: 'user', reason: 'spam' }).success, true);
  assert.equal(reportSchema.safeParse({ targetId: id, targetType: 'comment', reason: 'spam' }).success, false);
  assert.equal(moderationAppealSchema.safeParse({ reason: 'أطلب مراجعة القرار' }).success, true);
  assert.equal(moderationAppealSchema.safeParse({ reason: '' }).success, false);
});

test('performance telemetry accepts only safe numeric payloads', () => {
  assert.equal(performanceSchema.safeParse({ name: 'LCP', value: 1200, path: '/' }).success, true);
  assert.equal(performanceSchema.safeParse({ name: 'x', value: -1 }).success, false);
});
