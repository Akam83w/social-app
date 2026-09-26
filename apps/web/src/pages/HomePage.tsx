import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlusIcon,
  HeartIcon,
  CommentIcon,
  SendIcon,
  BookmarkIcon,
  MoreIcon,
} from "../components/icons/Icons";
import { stories } from "../data/stories";
import { apiRequest, likePost, unlikePost } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type ApiPost = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  likedByMe: boolean;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

function formatPostTime(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "الآن";
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `منذ ${diffDays} يوم`;

  return date.toLocaleDateString("ar-IQ");
}

export default function HomePage() {
  const { token, user } = useAuth();

  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPosts([]);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadPosts() {
      try {
        setLoading(true);
        setError(null);

        const data = await apiRequest("/posts", token);

        if (active) {
          setPosts(data.posts ?? []);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "تعذر تحميل المنشورات",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPosts();

    return () => {
      active = false;
    };
  }, [token]);

  const toggleLike = async (id: string) => {
    if (!token) return;

    const post = posts.find((item) => item.id === id);
    if (!post) return;

    try {
      if (post.likedByMe) {
        await unlikePost(id, token);
        setPosts((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  likedByMe: false,
                  likeCount: Math.max(0, item.likeCount - 1),
                }
              : item,
          ),
        );
      } else {
        await likePost(id, token);
        setPosts((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  likedByMe: true,
                  likeCount: item.likeCount + 1,
                }
              : item,
          ),
        );
      }
    } catch (err) {
      console.error("Like action failed:", err);
    }
  };

  const toggleSave = (id: string) => {
    setSavedPosts((current) =>
      current.includes(id)
        ? current.filter((postId) => postId !== id)
        : [...current, id],
    );
  };

  return (
    <main className="feed-container">
      <section className="stories-card">
        <div className="section-heading">
          <h2>القصص</h2>
          <Link to="/stories">مشاهدة الكل</Link>
        </div>

        <div className="stories-row">
          {stories.map((story) => (
            <Link
              to={story.own ? "/create" : `/stories/${story.name}`}
              className="story"
              key={story.name}
            >
              <div className={`story-ring ${story.own ? "own" : ""}`}>
                <div className="story-image">
                  <img src={story.own ? (user?.avatarUrl || story.image) : story.image} alt={story.name} />
                </div>

                {story.own && (
                  <span className="story-plus">
                    <PlusIcon size={12} strokeWidth={2.5} />
                  </span>
                )}
              </div>

              <span>{story.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="feed-heading">
        <div>
          <p>أحدث المنشورات</p>
          <h1>لك اليوم</h1>
        </div>

        <button className="filter-button">لك ▾</button>
      </div>

      <section className="posts">
        {loading && (
          <div className="post-card">
            <div className="post-content">
              <p>جاري تحميل المنشورات...</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="post-card">
            <div className="post-content">
              <strong>تعذر تحميل المنشورات</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="post-card">
            <div className="post-content">
              <strong>ماكو منشورات حالياً</strong>
              <p>أول منشور تكتبه راح يظهر هنا.</p>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          posts.map((post) => {
            const liked = post.likedByMe;
            const saved = savedPosts.includes(post.id);

            return (
              <article className="post-card" key={post.id}>
                <header className="post-header">
                  <Link
                    to={`/u/${encodeURIComponent(post.user.username)}`}
                    className="post-user"
                  >
                    <div className="post-avatar">
                      <img
                        src={post.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          post.user.displayName || post.user.username,
                        )}&background=random`}
                        alt={post.user.username}
                      />
                    </div>

                    <div className="post-user-info">
                      <strong>{post.user.displayName || post.user.username}</strong>
                      <span>@{post.user.username} · {formatPostTime(post.createdAt)}</span>
                    </div>
                  </Link>

                  {post.user.id === user?.id ? (
                    <button className="more-button" type="button" aria-label="حذف المنشور"
                      onClick={async () => {
                        if (!token || !window.confirm("تحذف هذا المنشور؟")) return;
                        try {
                          await apiRequest(`/posts/${post.id}`, token, { method: "DELETE" });
                          setPosts((current) => current.filter((item) => item.id !== post.id));
                        } catch (err) { console.error(err); }
                      }}>
                      حذف
                    </button>
                  ) : (
                    <button className="more-button" type="button" aria-label="المزيد"><MoreIcon /></button>
                  )}
                </header>

                {post.content && (
                  <div className="post-text">
                    <Link to={`/post/${post.id}`}>{post.content}</Link>
                  </div>
                )}

                {post.mediaUrl ? (
                  <Link to={`/post/${post.id}`} className="post-media">
                    {post.mediaType === "video" ? (
                      <video src={post.mediaUrl} className="post-video" controls muted playsInline preload="metadata" />
                    ) : (
                      <img src={post.mediaUrl} alt={post.content || "منشور"} />
                    )}
                  </Link>
                ) : null}

                <div className="post-actions">
                  <div className="actions-left">
                    <button
                      type="button"
                      className={liked ? "action liked" : "action"}
                      onClick={() => void toggleLike(post.id)}
                      aria-label="إعجاب"
                    >
                      <HeartIcon filled={liked} />
                    </button>

                    <Link
                      to={`/post/${post.id}#comments`}
                      className="action"
                      aria-label="التعليقات"
                    >
                      <CommentIcon />
                    </Link>

                    <button
                      type="button"
                      className="action"
                      onClick={() => {
                        const url = `${window.location.origin}/post/${post.id}`;
                        navigator.clipboard?.writeText(url);
                      }}
                      aria-label="مشاركة"
                    >
                      <SendIcon />
                    </button>
                  </div>

                  <button
                    type="button"
                    className={saved ? "action saved" : "action"}
                    onClick={() => toggleSave(post.id)}
                    aria-label="حفظ"
                  >
                    <BookmarkIcon />
                  </button>
                </div>

                <div className="post-content">
                  <strong>
                    {post.likeCount.toLocaleString("ar-IQ")} إعجاب
                  </strong>

                  {post.content && (
                    <p className="post-caption">
                      <Link to={`/u/${encodeURIComponent(post.user.username)}`}>
                        <b>{post.user.username}</b>
                      </Link>{" "}
                      {post.content}
                    </p>
                  )}

                  <Link
                    to={`/post/${post.id}#comments`}
                    className="comments-link"
                  >
                    عرض التعليقات
                  </Link>

                  <time>{formatPostTime(post.createdAt)}</time>
                </div>
              </article>
            );
          })}
      </section>
    </main>
  );
}
