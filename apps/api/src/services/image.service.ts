import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'sdm-media';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
let storageClient: SupabaseClient | null = null;

function getStorageClient() {
  if (storageClient) return storageClient;
  const url = process.env.SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');

  storageClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete('authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  return storageClient;
}

async function ensureBucket() {
  const client = getStorageClient();
  const { data, error } = await client.storage.listBuckets();
  if (error) throw error;

  if (!data?.some((bucket) => bucket.name === BUCKET)) {
    const { error: createError } = await client.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '100MB',
    });
    if (createError && !/already exists/i.test(createError.message)) throw createError;
  }
}

function extensionFor(contentType: string) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/gif') return 'gif';
  return 'webp';
}

export async function createDirectImageUpload(
  ownerId: string,
  contentType: string,
  size: number,
) {
  if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    throw new Error('IMAGE_TOO_LARGE');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new Error('INVALID_IMAGE_TYPE');
  }

  await ensureBucket();

  const client = getStorageClient();
  const objectName = `images/${ownerId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUploadUrl(objectName, { upsert: false });

  if (error || !data?.token || !data?.signedUrl) {
    throw error || new Error('IMAGE_UPLOAD_URL_FAILED');
  }

  return {
    bucketName: BUCKET,
    objectName,
    token: data.token,
    signedUrl: data.signedUrl,
    mediaUrl: client.storage.from(BUCKET).getPublicUrl(objectName).data.publicUrl,
    mediaType: 'image' as const,
  };
}
