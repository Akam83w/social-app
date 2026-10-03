import OptimizedImage from "../components/OptimizedImage";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiRequest,
  createComment,
  getPostComments,
  likePost,
  unlikePost,
  likeComment,
  unlikeComment,
  readCache,
  writeCache,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "../components/VideoPlayer";

type User = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  supporterNumber?: string | null;
  supporterExpiresAt?: string | null;
  verifiedAt?: string | null;
  isFounder?: boolean;
};

type Reel = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaPoster?: string | null;
  likeCount: number;
  likedByMe?: boolean;
  user: User;
};

type Comment = {
  id: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  likedByMe: boolean;
  user: User;
};

function MentionText({ content }: { content: string }) {
  const parts = content.split(/(@[A-Za-z0-9_.-]{2,50})/g);
  return (
    <>
      {parts.map((part, index) =>
        /^@[A-Za-z0-9_.-]{2,50}$/.test(part) ? (
          <Link
            key={index}
            to={"/u/" + encodeURIComponent(part.slice(1))}
            style={{ color: "#1877f2", fontWeight: 700, textDecoration: "none" }}
          >
            {part}
          </Link>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export default function ReelsPage() {
  const { token } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [commentsReel, setCommentsReel] = useState<Reel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSending, setCommentSending] = useState(false);
  const [mentionUser, setMentionUser] = useState<User | null>(null);
  const [shareBusy, setShareBusy] = useState<string | null>(null);
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

    apiRequest("/posts?limit=30", token)
      .then((data: any) => {
        if (!active) return;
        const videos = (data.posts ?? []).filter(
          (post: Reel) => post.mediaType === "video" && post.mediaUrl,
        );
        setReels(videos);
        setLikedIds(new Set(videos.filter((post: Reel) => post.likedByMe).map((post: Reel) => post.id)));
        setActiveId((current) =>
          current && videos.some((post: Reel) => post.id === current)
            ? current
            : (videos[0]?.id ?? null),
        );
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
    if (!token) return;
    const wasLiked = Boolean(reel.likedByMe || likedIds.has(reel.id));

    // Keep the heart animation for every double tap, but toggle the actual like.
    setHeartReelId(reel.id);
    window.setTimeout(() => setHeartReelId((current) => current === reel.id ? null : current), 700);

    setLikedIds((current) => {
      const next = new Set(current);
      if (wasLiked) next.delete(reel.id);
      else next.add(reel.id);
      return next;
    });
    setReels((current) =>
      current.map((item) =>
        item.id === reel.id
          ? { ...item, likeCount: Math.max(0, (item.likeCount || 0) + (wasLiked ? -1 : 1)), likedByMe: !wasLiked }
          : item,
      ),
    );

    try {
      if (wasLiked) await unlikePost(reel.id, token);
      else await likePost(reel.id, token);
    } catch {
      setLikedIds((current) => {
        const next = new Set(current);
        if (wasLiked) next.add(reel.id);
        else next.delete(reel.id);
        return next;
      });
      setReels((current) =>
        current.map((item) =>
          item.id === reel.id
            ? { ...item, likeCount: Math.max(0, (item.likeCount || 0) + (wasLiked ? 1 : -1)), likedByMe: wasLiked }
            : item,
        ),
      );
    }
  };

  const openComments = async (reel: Reel) => {
    if (!token) return;
    setCommentsReel(reel);
    setComments([]);
    setCommentText("");
    setReplyText("");
    setReplyingTo(null);
    setMentionUser(null);
    setCommentsLoading(true);
    try {
      const data = await getPostComments(reel.id, token) as { comments: Comment[] };
      setComments(data.comments ?? []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!token) return;
    const current = comments.find((comment) => comment.id === commentId);
    if (!current) return;
    setComments((items) => items.map((comment) => comment.id === commentId ? { ...comment, likedByMe: !comment.likedByMe, likeCount: Math.max(0, comment.likeCount + (comment.likedByMe ? -1 : 1)) } : comment));
    try {
      if (current.likedByMe) await unlikeComment(commentId, token);
      else await likeComment(commentId, token);
    } catch {
      setComments((items) => items.map((comment) => comment.id === commentId ? { ...comment, likedByMe: current.likedByMe, likeCount: current.likeCount } : comment));
    }
  };

  const addComment = async (parentCommentId?: string) => {
    const content = (parentCommentId ? replyText : commentText).trim();
    if (!token || !commentsReel || !content || commentSending) return;

    setCommentSending(true);
    try {
      const data = await createComment(commentsReel.id, content, token, parentCommentId) as {
        comment: Omit<Comment, "user">;
      };
      const newComment: Comment = {
        ...data.comment,
        parentCommentId: parentCommentId ?? null,
        likeCount: 0,
        likedByMe: false,
        user: {
          id: "me",
          username: "me",
          displayName: "أنت",
          avatarUrl: null,
        },
      };
      setComments((current) => [...current, newComment]);
      if (parentCommentId) {
        setReplyText("");
        setReplyingTo(null);
      } else {
        setCommentText("");
      }
      setMentionUser(null);
    } catch {
      setError("تعذر نشر التعليق.");
    } finally {
      setCommentSending(false);
    }
  };

  const updateCommentText = async (value: string, isReply = false) => {
    if (isReply) setReplyText(value);
    else setCommentText(value);

    const match = value.match(/(^|\s)@([A-Za-z0-9_.-]{2,50})$/);
    if (!token || !match) {
      setMentionUser(null);
      return;
    }
    try {
      const data = await apiRequest("/auth/search/users/" + encodeURIComponent(match[2]), token) as { user?: User };
      setMentionUser(data.user ?? null);
    } catch {
      setMentionUser(null);
    }
  };

  const insertMention = (username: string, isReply = false) => {
    const value = isReply ? replyText : commentText;
    const next = value.replace(/(^|\s)@[A-Za-z0-9_.-]{0,50}$/, "$1@" + username + " ");
    if (isReply) setReplyText(next);
    else setCommentText(next);
    setMentionUser(null);
  };

  const shareReel = async (reel: Reel) => {
    if (shareBusy) return;
    setShareBusy(reel.id);
    try {
      const url = window.location.origin + "/post/" + encodeURIComponent(reel.id);
      if (navigator.share) {
        await navigator.share({
          title: reel.user.displayName || reel.user.username,
          text: reel.content || "شوف هذا الريلز على إنستعراق 🇮🇶",
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setError("تم نسخ رابط الريلز.");
        window.setTimeout(() => setError(""), 1800);
      }
    } catch {
      // إلغاء نافذة المشاركة لا يعتبر خطأ.
    } finally {
      setShareBusy(null);
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
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        }
        if (best && best.isIntersecting && best.intersectionRatio >= 0.65) {
          const id = best.target.getAttribute("data-reel-id");
          if (id) setActiveId(id);
        }
      },
      { root: list, threshold: [0.25, 0.5, 0.65, 0.8, 1] },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !activeId) return;
    const activeCard = list.querySelector<HTMLElement>(
      ".reel-card[data-reel-id=\"" + CSS.escape(activeId) + "\"]",
    );
    activeCard?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const rootComments = comments.filter((comment) => comment.parentCommentId === null);

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
            <article className="reel-card" data-reel-id={reel.id} key={reel.id}>
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
                <Link to={"/u/" + encodeURIComponent(reel.user.username)} className="reel-user">
                  <OptimizedImage
                    src={reel.user.avatarUrl || "https://ui-avatars.com/api/?name=" + encodeURIComponent(reel.user.username) + "&background=random"}
                    alt=""
                  />
                  <div>
                    <strong>{reel.user.displayName || reel.user.username}</strong>
                    <span>@{reel.user.username}</span>
                  </div>
                </Link>
                {reel.content && <p>{reel.content}</p>}
              </div>

              <div className="reel-actions">
                <button type="button" aria-label="إعجاب" onClick={() => void handleDoubleTapLike(reel)}>
                  {likedIds.has(reel.id) ? "❤️" : "♡"}
                  <span>{(reel.likeCount || 0).toLocaleString("ar-IQ")}</span>
                </button>
                <button type="button" aria-label="تعليقات" onClick={() => void openComments(reel)}>
                  💬
                  <span>تعليق</span>
                </button>
                <button type="button" aria-label="مشاركة" onClick={() => void shareReel(reel)} disabled={shareBusy === reel.id}>
                  ↗
                  <span>{shareBusy === reel.id ? "..." : "مشاركة"}</span>
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>

      {commentsReel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تعليقات الريلز"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCommentsReel(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,.58)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <section
            style={{
              width: "min(680px,100%)",
              maxHeight: "78vh",
              background: "#fff",
              borderRadius: "22px 22px 0 0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              direction: "rtl",
            }}
          >
            <header style={{ padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>التعليقات</strong>
              <button type="button" onClick={() => setCommentsReel(null)} style={{ border: 0, background: "transparent", fontSize: 24 }}>×</button>
            </header>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {commentsLoading ? (
                <div style={{ textAlign: "center", color: "#777", padding: 30 }}>جاري تحميل التعليقات...</div>
              ) : rootComments.length === 0 ? (
                <div style={{ textAlign: "center", color: "#777", padding: 30 }}>كن أول من يعلّق.</div>
              ) : (
                rootComments.map((comment) => {
                  const replies = comments.filter((item) => item.parentCommentId === comment.id);
                  return (
                    <div key={comment.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <OptimizedImage
                          src={comment.user.avatarUrl || "https://ui-avatars.com/api/?name=" + encodeURIComponent(comment.user.username)}
                          alt=""
                          style={{ width: 38, height: 38, borderRadius: "50%", flex: "0 0 auto" }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <Link to={"/u/" + encodeURIComponent(comment.user.username)} style={{ fontWeight: 700, color: "#111", textDecoration: "none" }}>
                            {comment.user.displayName || comment.user.username}
                          </Link>
                          <div style={{ marginTop: 4, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                            <MentionText content={comment.content} />
                          </div>
                          <div style={{ display: "flex", gap: 14, marginTop: 5, fontSize: 12, color: "#777" }}>
                            <button type="button" onClick={() => void toggleCommentLike(comment.id)} style={{ color: comment.likedByMe ? "#d00" : "#777", fontWeight: 700 }}>
                              {comment.likedByMe ? "❤️" : "♡"} {comment.likeCount || 0}
                            </button>
                            <button type="button" onClick={() => { setReplyingTo(comment.id); setReplyText(""); }}>رد</button>
                            <span>{new Date(comment.createdAt).toLocaleString("ar-IQ")}</span>
                          </div>
                        </div>
                      </div>

                      {replies.map((reply) => (
                        <div key={reply.id} style={{ marginRight: 48, marginTop: 10, display: "flex", gap: 8 }}>
                          <OptimizedImage
                            src={reply.user.avatarUrl || "https://ui-avatars.com/api/?name=" + encodeURIComponent(reply.user.username)}
                            alt=""
                            style={{ width: 30, height: 30, borderRadius: "50%", flex: "0 0 auto" }}
                          />
                          <div>
                            <Link to={"/u/" + encodeURIComponent(reply.user.username)} style={{ fontWeight: 700, color: "#111", textDecoration: "none" }}>
                              {reply.user.displayName || reply.user.username}
                            </Link>
                            <div style={{ marginTop: 3 }}><MentionText content={reply.content} /></div>
                          </div>
                        </div>
                      ))}

                      {replyingTo === comment.id && (
                        <div style={{ marginRight: 48, marginTop: 9 }}>
                          <input
                            value={replyText}
                            onChange={(e) => void updateCommentText(e.target.value, true)}
                            placeholder="اكتب رد أو @منشن..."
                            disabled={commentSending}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void addComment(comment.id);
                              }
                            }}
                            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: 12, padding: "10px 12px", fontFamily: "inherit" }}
                          />
                          {mentionUser && (
                            <button type="button" onClick={() => insertMention(mentionUser.username, true)} style={{ marginTop: 6, width: "100%", display: "flex", gap: 8, alignItems: "center", padding: 8, border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
                              <OptimizedImage src={mentionUser.avatarUrl || "https://ui-avatars.com/api/?name=" + encodeURIComponent(mentionUser.username)} alt="" style={{ width: 30, height: 30, borderRadius: "50%" }} />
                              <span><strong>{mentionUser.displayName || mentionUser.username}</strong> @{mentionUser.username}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ borderTop: "1px solid #eee", padding: 12 }}>
              <div style={{ position: "relative" }}>
                <input
                  value={commentText}
                  onChange={(e) => void updateCommentText(e.target.value)}
                  placeholder="اكتب تعليق أو @منشن لصديق..."
                  disabled={commentSending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void addComment();
                    }
                  }}
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: 14, padding: "12px 14px", fontFamily: "inherit" }}
                />
                {mentionUser && (
                  <button type="button" onClick={() => insertMention(mentionUser.username)} style={{ marginTop: 6, width: "100%", display: "flex", gap: 8, alignItems: "center", padding: 8, border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
                    <OptimizedImage src={mentionUser.avatarUrl || "https://ui-avatars.com/api/?name=" + encodeURIComponent(mentionUser.username)} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                    <span><strong>{mentionUser.displayName || mentionUser.username}</strong> @{mentionUser.username}</span>
                  </button>
                )}
              </div>
              <button type="button" onClick={() => void addComment()} disabled={commentSending || !commentText.trim()} style={{ marginTop: 8, width: "100%", border: 0, borderRadius: 14, padding: 12, background: "#111", color: "#fff", fontFamily: "inherit" }}>
                {commentSending ? "جاري النشر..." : "نشر التعليق"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
