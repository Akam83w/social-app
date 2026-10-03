const ALLOWED_DATA_IMAGE=/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/i;

function storageHost() {
  const configured=String(process.env.SUPABASE_URL||'').trim();
  if(!configured)return '';
  try{return new URL(configured).hostname.toLowerCase();}catch{return '';}
}

export function isSafeImageReference(value:string) {
  if(ALLOWED_DATA_IMAGE.test(value)) return true;
  try {
    const url=new URL(value);
    if(url.protocol!=='https:') return false;
    const host=url.hostname.toLowerCase();
    const configured=storageHost();
    if(configured && host===configured) return true;
    if(host.endsWith('.storage.supabase.co')) return true;
    return false;
  } catch {
    return false;
  }
}

export function assertSafeImageReference(value:string) {
  if(!isSafeImageReference(value)) throw new Error('INVALID_MEDIA_REFERENCE');
}
