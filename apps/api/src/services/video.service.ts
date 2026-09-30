import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'sdm-media';
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

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
  const { data } = await client.storage.listBuckets();
  const exists = data?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await client.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '100MB' });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
}
\nexport async function createDirectVideoUpload(ownerId: string, contentType: string, extension: string, size: number) {
  if (size > MAX_VIDEO_BYTES) throw new Error('VIDEO_TOO_LARGE');
  await ensureBucket();
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
  const remotePath = `videos/${ownerId}/originals/${crypto.randomUUID()}.${safeExtension}`;
  const { data, error } = await getStorageClient().storage.from(BUCKET).createSignedUploadUrl(remotePath, { upsert: false });
  if (error || !data?.token) throw error || new Error('VIDEO_UPLOAD_INIT_FAILED');
  const configuredUrl = process.env.SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co';
  const parsed = new URL(configuredUrl);
  const storageHost = parsed.hostname.endsWith('.supabase.co')
    ? parsed.hostname.replace(/\.supabase\.co$/i, '.storage.supabase.co')
    : parsed.hostname;
  const endpoint = `${parsed.protocol}//${storageHost}/storage/v1/upload/resumable`;
  return { bucketName: BUCKET, objectName: remotePath, token: data.token, endpoint };
}

export function getPublicVideoUrl(remotePath: string) {
  return getStorageClient().storage.from(BUCKET).getPublicUrl(remotePath).data.publicUrl;
}

export async function downloadVideoToFile(remotePath: string, localPath: string) {
  const response = await fetch(getPublicVideoUrl(remotePath), { cache: 'no-store' });
  if (!response.ok || !response.body) throw new Error('VIDEO_SOURCE_DOWNLOAD_FAILED');
  const { Readable } = await import('node:stream');
  const { pipeline } = await import('node:stream/promises');
  await pipeline(Readable.fromWeb(response.body as any), (await import('node:fs')).createWriteStream(localPath));
}

function runFfmpeg(args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error('FFMPEG_FAILED: ' + stderr.slice(-4000))));
  });
}

async function uploadFile(client: SupabaseClient, localPath: string, remotePath: string, contentType: string) {
  const buffer = await fs.readFile(localPath);
  const { error } = await client.storage.from(BUCKET).upload(remotePath, buffer, {
    contentType,
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw error;
  return client.storage.from(BUCKET).getPublicUrl(remotePath).data.publicUrl;
}

export async function uploadOriginalVideo(inputPath: string, ownerId: string, contentType: string, extension = 'mp4') {
  await ensureBucket();
  const id = crypto.randomUUID();
  const remotePath = `videos/${ownerId}/originals/${id}.${extension.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp4'}`;
  const mediaUrl = await uploadFile(getStorageClient(), inputPath, remotePath, contentType || 'video/mp4');
  return { mediaUrl, remotePath };
}

export async function removeStorageFile(remotePath: string) {
  const { error } = await getStorageClient().storage.from(BUCKET).remove([remotePath]);
  if (error) throw error;
}

export async function processVideo(inputPath: string, ownerId: string) {
  const stat = await fs.stat(inputPath);
  if (stat.size > MAX_VIDEO_BYTES) throw new Error('VIDEO_TOO_LARGE');

  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'sdm-video-'));
  const id = crypto.randomUUID();
  const output = path.join(work, 'hls');
  await fs.mkdir(output, { recursive: true });

  try {
    await ensureBucket();
    await runFfmpeg([
      '-i', inputPath,
      '-filter_complex',
      '[0:v]split=3[v0][v1][v2];' +
      '[v0]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v360];' +
      '[v1]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v480];' +
      '[v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720]',
      '-map','[v360]','-map','0:a?',
      '-map','[v480]','-map','0:a?',
      '-map','[v720]','-map','0:a?',
      '-c:v:0','libx264','-preset','veryfast','-profile:v:0','main','-b:v:0','500k','-maxrate:v:0','600k','-bufsize:v:0','1000k',
      '-c:v:1','libx264','-preset','veryfast','-profile:v:1','main','-b:v:1','900k','-maxrate:v:1','1100k','-bufsize:v:1','1800k',
      '-c:v:2','libx264','-preset','veryfast','-profile:v:2','high','-b:v:2','1800k','-maxrate:v:2','2100k','-bufsize:v:2','3600k',
      '-c:a','aac','-b:a','96k','-ar','48000','-ac','2',
      '-g','48','-keyint_min','48','-sc_threshold','0',
      '-f','hls','-hls_time','4','-hls_playlist_type','vod',
      '-hls_segment_type','fmp4','-hls_fmp4_init_filename','init_%v.mp4',
      '-hls_segment_filename',path.join(output,'seg_%v_%03d.m4s'),
      '-master_pl_name','master.m3u8',
      '-var_stream_map','v:0,a:0,name:360p v:1,a:1,name:480p v:2,a:2,name:720p',
      path.join(output,'index_%v.m3u8')
    ], work);

    await runFfmpeg([
      '-i', inputPath, '-frames:v','1', '-vf',
      'scale=w=720:h=720:force_original_aspect_ratio=decrease,pad=720:720:(ow-iw)/2:(oh-ih)/2',
      '-q:v','4', path.join(work,'poster.jpg')
    ], work);

    const client = getStorageClient();
    const remoteRoot = `videos/${ownerId}/${id}`;
    const files = await fs.readdir(output);
    for (const file of files) {
      const type = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : file.endsWith('.m4s') ? 'video/iso.segment' : 'video/mp4';
      await uploadFile(client, path.join(output,file), `${remoteRoot}/${file}`, type);
    }
    const posterUrl = await uploadFile(client, path.join(work,'poster.jpg'), `${remoteRoot}/poster.jpg`, 'image/jpeg');
    const masterUrl = client.storage.from(BUCKET).getPublicUrl(`${remoteRoot}/master.m3u8`).data.publicUrl;

    return { mediaUrl: masterUrl, mediaPoster: posterUrl, mediaType: 'video' as const };
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}