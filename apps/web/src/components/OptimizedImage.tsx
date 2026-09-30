import React from "react";

const SUPABASE_PUBLIC_OBJECT = /^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/object\/public\/([^?]+)$/;

export function optimizeImageUrl(src: string, width = 800, quality = 78): string {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
  const match = src.match(SUPABASE_PUBLIC_OBJECT);
  if (!match) return src;
  const [, origin, path] = match;
  return `${origin}/storage/v1/render/image/public/${path}?width=${Math.min(Math.max(Math.round(width), 1), 2500)}&quality=${Math.min(Math.max(Math.round(quality), 20), 100)}`;
}

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  widthHint?: number;
  quality?: number;
};

export default function OptimizedImage({ src = "", widthHint = 800, quality = 78, loading = "lazy", decoding = "async", onError, ...props }: Props) {
  const [fallback, setFallback] = React.useState(false);
  const optimized = optimizeImageUrl(src, widthHint, quality);
  const actualSrc = fallback ? src : optimized;
  return (
    <img
      {...props}
      src={actualSrc}
      loading={loading}
      decoding={decoding}
      onError={event => {
        if (!fallback && optimized !== src) {
          setFallback(true);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
