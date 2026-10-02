import OptimizedImage from "../components/OptimizedImage";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, readCache, writeCache } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "../components/VideoPlayer";
import { likePost } from "../lib/api";

type Reel = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaPoster?: string | null;
  likeCount: number;
  likedByMe?: boolean;
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export default function ReelsPage() {
  const { token } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const cacheKey = "reels-feed";
    const cached = readCache<Reel[]>(cacheKey, 2 * 60 * 1000);
    if (cached?.length) {
      setReels(cached);
      setLikedIds(new Set(cached.filter((post) => post.likedByMe).map((post) => post.id)));
      setActiveId(cached[0]?.id ?? null);
    }

    apiRequest("/posts?limit=20", token)
      .then((data: any) => {
        if (!active) return;
        const videos = (data.posts ?? []).filter(
          (post: Reel) => post.mediaType === "video" && post.mediaUrl
        );
        setReels(videos);
        setLikedIds(new Set(videos.filter((post: Reel) => post.likedByMe).map((post: Reel) => post.id)));
        setActiveId((current) => current && videos.some((post: Reel) => post.id === current) ? current : (videos[0]?.id ?? null));
        writeCache(cacheKey, videos);
      })
      .catch(() => {
        if (active && !cached?.length) setError("تعذر تحميل الريلز.");
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleDoubleTapLike = async (reel: Reel) => {
    if (!token || likedIds.has(reel.id)) return;
    setLikedIds((current) => new Set(current).add(reel.id));
    setReels((current) =>
      current.map((item) =>
        item.id === reel.id
          ? { ...item, likeCount: (item.likeCount || 0) + 1, likedByMe: true }
          : item
      )
    );
    try {
      await likePost(reel.id, token);
    } catch {
      setLikedIds((current) => {
        const next = new Set(current);
        next.delete(reel.id);
        return next;
      });
      setReels((current) =>
        current.map((item) =>
          item.id === reel.id
            ? { ...item, likeCount: Math.max(0, (item.likeCount || 0) - 1), likedByMe: false }
            : item
        )
      );
    }
  };

  useEffect(() => {
    const list = listRef.current;
    if (!list || !reels.length) return;

    const cards = Array.from(list.querySelectorAll<HTMLElement>(".reel-card"));
    if (!cards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;

        for (const entry of entries) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }

        if (best && best.isIntersecting && best.intersectionRatio >= 0.65) {
          const id = best.target.getAttribute("data-reel-id");
          if (id) setActiveId(id);
        }
      },
      {
        root: list,
        threshold: [0.25, 0.5, 0.65, 0.8, 1],
      }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !activeId) return;

    const activeCard = list.querySelector<HTMLElement>(
      `.reel-card[data-reel-id="${CSS.escape(activeId)}"]`
    );

    activeCard?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <main className="feed-container reels-feed-shell">
      <div className="reels-page">
        <div className="reels-topbar">
          <strong>ريلز</strong>
          <Link to="/create" aria-label="إنشاء فيديو">＋</Link>
        </div>

        {error && <div className="reels-overlay-message">{error}</div>}

        {!error && reels.length === 0 && (
          <div className="reels-overlay-message">ماكو ريلز منشورة حالياً.</div>
        )}

        <section className="reels-list" ref={listRef} aria-label="ريلز">
          {reels.map((reel) => (
            <article
              className="reel-card"
              data-reel-id={reel.id}
              key={reel.id}
            >
              <div className="reel-video-wrap">
                <VideoPlayer
                  src={reel.mediaUrl || ""}
                  poster={reel.mediaPoster}
                  className="reel-video"
                  controls={false}
                  muted={false}
                  autoSound
                  active={activeId === reel.id}
                  customControls
                  onDoubleTap={() => void handleDoubleTapLike(reel)}
                />
              </div>

              <div className="reel-gradient" />

              <div className="reel-info">
                <Link
                  to={"/u/" + encodeURIComponent(reel.user.username)}
                  className="reel-user"
                >
                  <OptimizedImage
                    src={
                      reel.user.avatarUrl ||
                      "https://ui-avatars.com/api/?name=" +
                        encodeURIComponent(reel.user.username) +
                        "&background=random"
                    }
                    alt=""
                  />
                  <div>
                    <strong>
                      {reel.user.displayName || reel.user.username}
                    </strong>
                    <span>@{reel.user.username}</span>
                  </div>
                </Link>

                {reel.content && <p>{reel.content}</p>}
              </div>

              <div className="reel-actions">
                <button type="button" aria-label="إعجاب">
                  {likedIds.has(reel.id) ? "❤️" : "♡"}
                  <span>{(reel.likeCount || 0).toLocaleString("ar-IQ")}</span>
                </button>
                <button type="button" aria-label="تعليقات">◯</button>
                <button type="button" aria-label="مشاركة">↗</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
