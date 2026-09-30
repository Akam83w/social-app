import { useEffect, useRef } from "react";
import Hls from "hls.js";

type Props = {
  src: string;
  poster?: string | null;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
};

export default function VideoPlayer({ src, poster, className, controls = true, muted = false, autoPlay = false }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    let loaded = false;

    const loadVideo = () => {
      if (loaded) return;
      loaded = true;
      if (src.includes(".m3u8")) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: true,
            capLevelToPlayerSize: true,
            startLevel: -1,
            maxBufferLength: 8,
            backBufferLength: 4,
            maxBufferSize: 6 * 1000 * 1000,
          });
          hls.loadSource(src);
          hls.attachMedia(video);
        }
      } else {
        video.src = src;
      }
    };

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          loadVideo();
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px", threshold: 0.01 }
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return <video ref={ref} className={className} poster={poster || undefined} controls={controls} muted={muted} autoPlay={autoPlay} playsInline preload="none" />;
}
