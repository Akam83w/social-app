import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Props = {
  src: string;
  poster?: string | null;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  active?: boolean;
  customControls?: boolean;
};

export default function VideoPlayer({
  src,
  poster,
  className,
  controls = true,
  muted = false,
  autoPlay = false,
  active = autoPlay,
  customControls = false,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const activeRef = useRef(active);
  const [playing, setPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);

  useEffect(() => {
    activeRef.current = active;
    const video = ref.current;
    if (!video) return;

    if (!active) {
      video.pause();
      setPlaying(false);
      return;
    }

    video.muted = true;
    setIsMuted(true);

    const play = () => {
      if (!activeRef.current) return;
      void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };

    if (video.readyState >= 2) {
      play();
      return;
    }

    video.addEventListener("loadeddata", play);
    video.addEventListener("canplay", play);
    return () => {
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", play);
    };
  }, [active]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    let loaded = false;
    let retryCount = 0;

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
            maxBufferLength: 10,
            backBufferLength: 4,
            maxBufferSize: 8 * 1000 * 1000,
            manifestLoadingMaxRetry: 3,
            levelLoadingMaxRetry: 3,
            fragLoadingMaxRetry: 3,
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal || !hls) return;

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCount < 2) {
              retryCount += 1;
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            }
          });

          hls.attachMedia(video);
          hls.loadSource(src);
        }
      } else {
        video.src = src;
      }
    };

    // The active reel must load immediately. Nearby reels can load when they
    // approach the viewport, which keeps scrolling smooth without blocking
    // the first frame.
    if (active) {
      loadVideo();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            loadVideo();
            observer.disconnect();
          }
        },
        { rootMargin: "900px 0px", threshold: 0.01 }
      );

      observer.observe(video);

      return () => {
        observer.disconnect();
        hls?.destroy();
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    return () => {
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, active]);

  const togglePlayback = () => {
    const video = ref.current;
    if (!video) return;

    if (video.paused) {
      void video.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = ref.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  return (
    <div className={customControls ? "video-player-shell video-player-custom" : "video-player-shell"}>
      <video
        ref={ref}
        className={className}
        poster={poster || undefined}
        controls={controls}
        muted={isMuted}
        autoPlay={false}
        playsInline
        preload="none"
        loop
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {customControls && (
        <div className="video-custom-controls" aria-label="تحكم بالفيديو">
          <button type="button" onClick={togglePlayback} aria-label={playing ? "إيقاف الفيديو" : "تشغيل الفيديو"}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button type="button" onClick={toggleMute} aria-label={isMuted ? "تفعيل الصوت" : "كتم الصوت"}>
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>
      )}
    </div>
  );
}
