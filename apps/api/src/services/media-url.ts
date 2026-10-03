const DATA_IMAGE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
function storageHost() {
  try { return new URL(process.env.SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co').hostname; } catch { return ''; }
}
export function isAllowedMediaUrl(value: string): boolean {
  if (DATA_IMAGE.test(value)) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === storageHost() && u.pathname.startsWith('/storage/v1/object/public/');
  } catch { return false; }
}
