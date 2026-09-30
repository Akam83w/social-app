import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'sdm-media';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
let storageClient: SupabaseClient | null = null;

function getStorageClient() {
  if (storageClient) return storageClient;
  const url = process.env.SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  storageClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return storageClient;
}

async function ensureBucket() {
  const client = getStorageClient();
  const { data, error } = await client.storage.listBuckets();
  if (error) throw error;
  if (!data?.some((b) => b.name === BUCKET)) {
    const { error: createError } = await client.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '100MB' });
    if (createError && !/already exists/i.test(createError.message)) throw createError;
  }
}

export async function uploadPostImage(buffer: Buffer, ownerId: string, contentType: string) {
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) throw new Error('INVALID_IMAGE_TYPE');

  await ensureBucket();
  const client = getStorageClient();
  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : contentType === 'image/gif' ? 'gif' : 'webp';
  const remotePath = `images/${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(remotePath, buffer, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return client.storage.from(BUCKET).getPublicUrl(remotePath).data.publicUrl;
}
