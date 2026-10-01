import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'sdm-media';
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const HLS_SEGMENT_SECONDS = 6;

type Rendition = {
  name: string;
  width: number;
  height: number;
  bitrate: number;
};

let storageClient: SupabaseClient | null = null;

function getStorageClient(): SupabaseClient {
  if (storageClient) return storageClient;

  const url = process.env.SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');

  // Supabase's newer sb_secret_* keys are backend keys, but must be sent
  // as apikey rather than as a JWT Authorization bearer token.
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
  if (error) throw new Error('STORAGE_BUCKET_LIST_FAILED: ' + error.message);

  if (!data?.some((bucket) => bucket.name === BUCKET)) {
    const { error: createError } = await client.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '100MB',
    });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error('STORAGE_BUCKET_CREATE_FAILED: ' + createError.message);
    }
  }
}

function safeExtension(extension: string) {
  return extension.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
}

export async function createDirectVideoUpload(
  ownerId: string,
  contentType: string,
  extension: string,
  size: number,
) {
  if (size > MAX_VIDEO_BYTES) throw new Error('VIDEO_TOO_LARGE');

  await ensureBucket();

  const remotePath =
    'videos/' + ownerId + '/originals/' + crypto.randomUUID() + '.' + safeExtension(extension);

  const { data, error } = await getStorageClient()
    .storage
    .from(BUCKET)
    .createSignedUploadUrl(remotePath, { upsert: false });

  if (error || !data?.token) {
    throw new Error('VIDEO_UPLOAD_SIGNED_URL_FAILED: ' + (error?.message || 'missing token'));
  }

  const configuredUrl =
    process.env.SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co';
  const parsed = new URL(configuredUrl);

  const storageHost = parsed.hostname.endsWith('.supabase.co')
    ? parsed.hostname.replace(/\\.supabase\\.co$/i, '.storage.supabase.co')
    : parsed.hostname;

  return {
    bucketName: BUCKET,
    objectName: remotePath,
    token: data.token,
    endpoint: parsed.protocol + '//' + storageHost + '/storage/v1/upload/resumable',
    contentType,
  };
}

export function getPublicVideoUrl(remotePath: string) {
  return getStorageClient().storage.from(BUCKET).getPublicUrl(remotePath).data.publicUrl;
}

export async function downloadVideoToFile(remotePath: string, localPath: string) {
  const response = await fetch(getPublicVideoUrl(remotePath), { cache: 'no-store' });
  if (!response.ok || !response.body) {
    throw new Error('VIDEO_SOURCE_DOWNLOAD_FAILED: HTTP ' + response.status);
  }

  const { Readable } = await import('node:stream');
  const { pipeline } = await import('node:stream/promises');

  await pipeline(
    Readable.fromWeb(response.body as any),
    (await import('node:fs')).createWriteStream(localPath),
  );
}

function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });

    child.on('error', (error) => {
      reject(new Error(command.toUpperCase() + '_NOT_AVAILABLE: ' + error.message));
    });

    child.on('close', (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(
        command.toUpperCase() + '_FAILED(' + code + '): ' + stderr.slice(-6000),
      ));
    });
  });
}

async function getVideoDimensions(inputPath: string) {
  const { stdout } = await runCommand('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'json',
    inputPath,
  ], path.dirname(inputPath));

  const parsed = JSON.parse(stdout);
  const stream = parsed.streams?.[0];

  if (!stream?.width || !stream?.height) {
    throw new Error('VIDEO_METADATA_INVALID');
  }

  return {
    width: Number(stream.width),
    height: Number(stream.height),
  };
}

function getRenditions(width: number, height: number): Rendition[] {
  const ratio = width / height;

  if (ratio < 0.75) {
    return [
      { name: '360p', width: 360, height: 640, bitrate: 450000 },
      { name: '480p', width: 480, height: 854, bitrate: 800000 },
      { name: '720p', width: 720, height: 1280, bitrate: 1400000 },
      { name: '1080p', width: 1080, height: 1920, bitrate: 2400000 },
    ].filter((r) => r.width <= width && r.height <= height);
  }

  if (ratio >= 0.9 && ratio <= 1.1) {
    return [
      { name: '360p', width: 360, height: 360, bitrate: 450000 },
      { name: '480p', width: 480, height: 480, bitrate: 800000 },
      { name: '720p', width: 720, height: 720, bitrate: 1400000 },
      { name: '1080p', width: 1080, height: 1080, bitrate: 2400000 },
    ].filter((r) => r.width <= width && r.height <= height);
  }

  return [
    { name: '360p', width: 640, height: 360, bitrate: 450000 },
    { name: '480p', width: 854, height: 480, bitrate: 800000 },
    { name: '720p', width: 1280, height: 720, bitrate: 1400000 },
    { name: '1080p', width: 1920, height: 1080, bitrate: 2400000 },
  ].filter((r) => r.width <= width && r.height <= height);
}

async function convertVariant(
  inputPath: string,
  outputDir: string,
  rendition: Rendition,
) {
  await fs.mkdir(outputDir, { recursive: true });

  const playlist = path.join(outputDir, rendition.name + '.m3u8');
  const segments = path.join(outputDir, rendition.name + '_%03d.ts');

  await runCommand('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,

    '-map', '0:v:0',
    '-map', '0:a:0?',

    '-vf',
    'scale=' + rendition.width + ':' + rendition.height +
    ':force_original_aspect_ratio=decrease,' +
    'pad=' + rendition.width + ':' + rendition.height +
    ':(ow-iw)/2:(oh-ih)/2',

    '-c:v', 'libx264',
    '-profile:v', 'main',
    '-preset', 'veryfast',
    '-b:v', String(rendition.bitrate),
    '-maxrate', String(Math.round(rendition.bitrate * 1.2)),
    '-bufsize', String(rendition.bitrate * 2),
    '-g', '48',
    '-keyint_min', '48',
    '-sc_threshold', '0',

    '-c:a', 'aac',
    '-b:a', '96k',
    '-ar', '48000',
    '-ac', '2',

    '-max_muxing_queue_size', '9999',
    '-f', 'hls',
    '-hls_time', String(HLS_SEGMENT_SECONDS),
    '-hls_list_size', '0',
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-start_number', '0',
    '-hls_segment_filename', segments,
    playlist,
  ], outputDir);

  return playlist;
}

async function createMasterPlaylist(
  outputDir: string,
  renditions: Rendition[],
) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS', ''];

  for (const rendition of renditions) {
    lines.push(
      '#EXT-X-STREAM-INF:BANDWIDTH=' +
      String(Math.round(rendition.bitrate * 1.15)) +
      ',AVERAGE-BANDWIDTH=' + String(rendition.bitrate) +
      ',RESOLUTION=' + rendition.width + 'x' + rendition.height +
      ',CODECS="avc1.4d401f,mp4a.40.2"',
    );
    lines.push(rendition.name + '.m3u8', '');
  }

  await fs.writeFile(
    path.join(outputDir, 'master.m3u8'),
    lines.join('\\n'),
    'utf8',
  );
}

async function createPoster(inputPath: string, outputPath: string) {
  await runCommand('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-ss', '00:00:01',
    '-i', inputPath,
    '-frames:v', '1',
    '-vf',
    'scale=720:720:force_original_aspect_ratio=decrease,' +
    'pad=720:720:(ow-iw)/2:(oh-ih)/2',
    '-q:v', '4',
    outputPath,
  ], path.dirname(inputPath));
}

async function uploadFile(
  client: SupabaseClient,
  localPath: string,
  remotePath: string,
  contentType: string,
) {
  const buffer = await fs.readFile(localPath);

  const { error } = await client.storage
    .from(BUCKET)
    .upload(remotePath, buffer, {
      contentType,
      cacheControl: '31536000',
      upsert: true,
    });

  if (error) throw new Error(
    'STORAGE_UPLOAD_FAILED: ' + remotePath + ': ' + error.message,
  );

  return client.storage.from(BUCKET).getPublicUrl(remotePath).data.publicUrl;
}

export async function processVideo(inputPath: string, ownerId: string) {
  const stat = await fs.stat(inputPath);
  if (stat.size <= 0) throw new Error('VIDEO_EMPTY');
  if (stat.size > MAX_VIDEO_BYTES) throw new Error('VIDEO_TOO_LARGE');

  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'sdm-video-'));
  const outputDir = path.join(work, 'hls');
  const videoId = crypto.randomUUID();

  try {
    await ensureBucket();

    const dimensions = await getVideoDimensions(inputPath);
    let renditions = getRenditions(dimensions.width, dimensions.height);

    if (renditions.length === 0) {
      renditions = [{ name: 'source', width: dimensions.width, height: dimensions.height, bitrate: 1200000 }];
    }

    await fs.mkdir(outputDir, { recursive: true });

    // Encode each rendition independently. This is slower than a single complex
    // FFmpeg command but is easier to recover/debug and mirrors the proven
    // HLS-converter architecture we are adapting.
    for (const rendition of renditions) {
      await convertVariant(inputPath, outputDir, rendition);
    }

    await createMasterPlaylist(outputDir, renditions);

    const posterPath = path.join(work, 'poster.jpg');
    await createPoster(inputPath, posterPath);

    const client = getStorageClient();
    const remoteRoot = 'videos/' + ownerId + '/' + videoId;

    const files = await fs.readdir(outputDir);
    for (const file of files) {
      const contentType = file.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'video/mp2t';
      await uploadFile(
        client,
        path.join(outputDir, file),
        remoteRoot + '/' + file,
        contentType,
      );
    }

    const posterUrl = await uploadFile(
      client,
      posterPath,
      remoteRoot + '/poster.jpg',
      'image/jpeg',
    );

    const masterUrl = client
      .storage
      .from(BUCKET)
      .getPublicUrl(remoteRoot + '/master.m3u8')
      .data.publicUrl;

    return {
      mediaUrl: masterUrl,
      mediaPoster: posterUrl,
      mediaType: 'video' as const,
    };
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

export async function removeStorageFile(remotePath: string) {
  const { error } = await getStorageClient()
    .storage
    .from(BUCKET)
    .remove([remotePath]);

  if (error) throw new Error('STORAGE_REMOVE_FAILED: ' + error.message);
}
