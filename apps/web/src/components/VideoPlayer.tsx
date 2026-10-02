import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";

type Props = {
  src: string;
  poster?: string | null;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  active?: boolean;
  customControls?: boolean;
  onDoubleTap?: () => void;
  autoSound?: boolean;
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
  onDoubleTap,
  autoSound = false,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const activeRef = useRef(active);
  const [playing, setPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundUnlockedRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
    const video = ref.current;
    if (!video) return;

    if (!active) {
      video.pause();
      setPlaying(false);
      return;
    }

    if (muted) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
    }

    const play = () => {
      if (!activeRef.current) return;
      video.muted = muted ? true : false;
      void video.play()
        .then(() => setPlaying(true))
        .catch(() => {
          if (!muted && autoSound) {
            video.muted = true;
            setIsMuted(true);
            void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
          } else {
            setPlaying(false);
          }
        });
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
  }, [active, muted, autoSound]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    let loaded = false;

    const loadVideo = async () => {
      if (loaded) return;
      loaded = true;

      if (src.includes(".m3u8")) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else {
          const HlsModule = (await import("hls.js")).default;
          if (!HlsModule.isSupported()) return;
          hls = new HlsModule({
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

    let observer: IntersectionObserver | null = null;

    if (active) {
      void loadVideo();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            void loadVideo();
            observer?.disconnect();
          }
        },
        { rootMargin: "900px 0px", threshold: 0.01 },
      );
      observer.observe(video);
    }

    return () => {
      observer?.disconnect();
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

  const showTemporaryControls = () => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 1400);
  };

  const toggleMute = () => {
    const video = ref.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVideoTap = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setHeartVisible(true);
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      heartTimerRef.current = setTimeout(() => setHeartVisible(false), 700);
      onDoubleTap?.();
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      showTemporaryControls();
      const video = ref.current;
      if (autoSound && !soundUnlockedRef.current && video) {
        soundUnlockedRef.current = true;
        video.muted = false;
        setIsMuted(false);
        void video.play().then(() => setPlaying(true)).catch(() => {});
        return;
      }
      togglePlayback();
    }, 220);
  };

  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
  }, []);

  return (
    <div className={customControls ? "video-player-shell video-player-custom" : "video-player-shell"} style={{ position: "relative" }}>
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
        onClick={handleVideoTap}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {heartVisible && onDoubleTap && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: "92px",
            lineHeight: 1,
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,.35))",
            pointerEvents: "none",
            animation: "reels-heart-pop .7s ease-out both",
            zIndex: 4,
          }}
        >
          ❤️
        </div>
      )}
      {customControls && controlsVisible && (
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
