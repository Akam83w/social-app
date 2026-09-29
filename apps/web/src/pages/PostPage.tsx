import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
import VideoPlayer from "../components/VideoPlayer";
  createComment,
  deleteComment,
  getPostComments,
  getPostLikeStatus,
  likePost,
  unlikePost,
  API_URL,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Post = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null; mediaPoster?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    supporterNumber: string | null;
    supporterExpiresAt: string | null;
    verifiedAt: string | null;
    isFounder: boolean;
  };
};

type Comment = {
  id: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    supporterNumber: string | null;
    supporterExpiresAt: string | null;
    verifiedAt: string | null;
    isFounder: boolean;
  };
};

export default function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);

  const [liking, setLiking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id || !token) return;

    const postId = id;
    const authToken = token;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [postResponse, commentsResponse, likeResponse] =
          await Promise.all([
            fetch(`${API_URL}/posts/${postId}`, {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }).then(async (res) => {
              const json = await res.json();

              if (!res.ok) {
                throw new Error(json.error || "REQUEST_FAILED");
              }

              return json as { post: Post };
            }),

            getPostComments(postId, authToken) as Promise<{
              comments: Comment[];
            }>,

            getPostLikeStatus(postId, authToken) as Promise<{
              likeCount: number;
              likedByMe: boolean;
            }>,
          ]);

        if (!cancelled) {
          setPost(postResponse.post);
          setComments(commentsResponse.comments);
          setLikeCount(likeResponse.likeCount);
          setLikedByMe(likeResponse.likedByMe);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "حدث خطأ أثناء تحميل المنشور",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  async function toggleLike() {
    if (!token || !id || liking) return;

    try {
      setLiking(true);
      setError("");

      if (likedByMe) {
        await unlikePost(id, token);
        setLikedByMe(false);
        setLikeCount((count) => Math.max(0, count - 1));
      } else {
        await likePost(id, token);
        setLikedByMe(true);
        setLikeCount((count) => count + 1);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر تحديث الإعجاب",
      );
    } finally {
      setLiking(false);
    }
  }

  async function addComment() {
    const content = commentText.trim();

    if (!content || !id || !token || sending) return;

    try {
      setSending(true);
      setError("");

      const response = (await createComment(
        id,
        content,
        token,
      )) as {
        comment: {
          id: string;
          parentCommentId: string | null;
          content: string;
          createdAt: string;
          updatedAt: string;
        };
      };

      const newComment: Comment = {
        ...response.comment,
        parentCommentId: null,
        user: {
          id: user?.id || "",
          username: user?.username || "مستخدم",
          displayName: user?.displayName || null,
          avatarUrl: user?.avatarUrl || null,
          supporterNumber: user?.supporterNumber || null,
          supporterExpiresAt: user?.supporterExpiresAt || null,
          verifiedAt: user?.verifiedAt || null,
          isFounder: user?.email?.trim().toLowerCase() === 'sdmtr033@gmail.com',
        },
      };

      setComments((current) => [...current, newComment]);
      setCommentText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر إرسال التعليق",
      );
    } finally {
      setSending(false);
    }
  }

  async function addReply(parentCommentId: string) {
    const content = replyText.trim();

    if (!content || !id || !token || sending) return;

    try {
      setSending(true);
      setError("");

      const response = (await createComment(
        id,
        content,
        token,
        parentCommentId,
      )) as {
        comment: {
          id: string;
          parentCommentId: string | null;
          content: string;
          createdAt: string;
          updatedAt: string;
        };
      };

      const newReply: Comment = {
        ...response.comment,
        parentCommentId,
        user: {
          id: user?.id || "",
          username: user?.username || "مستخدم",
          displayName: user?.displayName || null,
          avatarUrl: user?.avatarUrl || null,
          supporterNumber: user?.supporterNumber || null,
          supporterExpiresAt: user?.supporterExpiresAt || null,
          verifiedAt: user?.verifiedAt || null,
          isFounder: user?.email?.trim().toLowerCase() === "sdmtr033@gmail.com",
        },
      };

      setComments((current) => [...current, newReply]);
      setReplyText("");
      setReplyingTo(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر إرسال الرد",
      );
    } finally {
      setSending(false);
    }
  }

  async function removeComment(commentId: string) {
    if (!token) return;

    try {
      setError("");

      await deleteComment(commentId, token);

      setComments((current) =>
        current.filter(
          (comment) =>
            comment.id !== commentId &&
            comment.parentCommentId !== commentId,
        ),
      );

      if (replyingTo === commentId) {
        setReplyingTo(null);
        setReplyText("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر حذف التعليق",
      );
    }
  }

  function renderComment(comment: Comment, isReply = false) {
    const replies = comments.filter(
      (item) => item.parentCommentId === comment.id,
    );

    return (
      <div
        key={comment.id}
        style={{
          marginRight: isReply ? 38 : 0,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 12,
            background: isReply ? "#fafafa" : "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <div>
              <Link
                to={`/u/${comment.user.username}`}
                style={{
                  fontWeight: 700,
                  textDecoration: "none",
                  color: "#111",
                }}
              >
                <span className={comment.user.supporterNumber && comment.user.supporterExpiresAt && new Date(comment.user.supporterExpiresAt).getTime() > Date.now() ? "supporter-name" : ""}>{comment.user.displayName || comment.user.username}</span>{comment.user.isFounder&&<span className="founder-star-inline" title="مؤسس SDM">★</span>}{!comment.user.isFounder&&comment.user.supporterNumber&&comment.user.supporterExpiresAt&&new Date(comment.user.supporterExpiresAt).getTime()>Date.now()&&<span className="supporter-star" title={`داعم مؤسس #${comment.user.supporterNumber}`}>★</span>}{comment.user.verifiedAt&&<span className="real-verified" title="حساب موثّق">✓</span>}
              </Link>

              <div
                style={{
                  color: "#777",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                @{comment.user.username}
              </div>
            </div>

            {comment.user.id === user?.id && (
              <button
                type="button"
                onClick={() => void removeComment(comment.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#c00",
                  cursor: "pointer",
                }}
              >
                حذف
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: 9,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {comment.content}
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 10,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setReplyingTo(
                  replyingTo === comment.id ? null : comment.id,
                );
                setReplyText("");
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "#555",
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              ↩ رد
            </button>

            <span
              style={{
                color: "#999",
                fontSize: 12,
              }}
            >
              {new Date(comment.createdAt).toLocaleString("ar-IQ")}
            </span>
          </div>

          {replyingTo === comment.id && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
              }}
            >
              <input
                value={replyText}
                onChange={(event) =>
                  setReplyText(event.target.value)
                }
                placeholder="اكتب ردك..."
                disabled={sending}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontFamily: "inherit",
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void addReply(comment.id);
                  }
                }}
              />

              <button
                type="button"
                onClick={() => void addReply(comment.id)}
                disabled={sending || !replyText.trim()}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "0 14px",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {sending ? "..." : "إرسال"}
              </button>
            </div>
          )}
        </div>

        {replies.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {replies.map((reply) =>
              renderComment(reply, true),
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        جاري التحميل...
      </main>
    );
  }

  if (error && !post) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "#c00" }}>{error}</p>
      </main>
    );
  }

  if (!post) {
    return (
      <main style={{ padding: 24 }}>
        المنشور غير موجود.
      </main>
    );
  }

  const rootComments = comments.filter(
    (comment) => comment.parentCommentId === null,
  );

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <Link
          to="/"
          style={{
            textDecoration: "none",
            color: "#555",
          }}
        >
          ← رجوع
        </Link>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 14,
            padding: 10,
            borderRadius: 10,
            background: "#fff0f0",
            color: "#b00020",
          }}
        >
          {error}
        </div>
      )}

      <article
        style={{
          border: "1px solid #eee",
          borderRadius: 18,
          padding: 18,
          background: "#fff",
        }}
      >
        <div>
          <Link
            to={`/u/${post.user.username}`}
            style={{
              fontWeight: 700,
              color: "#111",
              textDecoration: "none",
            }}
          >
            <span className={post.user.supporterNumber&&post.user.supporterExpiresAt&&new Date(post.user.supporterExpiresAt).getTime()>Date.now()?"supporter-name":""}>{post.user.displayName||post.user.username}</span>{post.user.isFounder&&<span className="founder-star-inline" title="مؤسس SDM">★</span>}{!post.user.isFounder&&post.user.supporterNumber&&post.user.supporterExpiresAt&&new Date(post.user.supporterExpiresAt).getTime()>Date.now()&&<span className="supporter-star" title={`داعم مؤسس #${post.user.supporterNumber}`}>★</span>}{post.user.verifiedAt&&<span className="real-verified" title="حساب موثّق">✓</span>}
          </Link>

          <div
            style={{
              color: "#777",
              fontSize: 13,
              marginTop: 3,
            }}
          >
            @{post.user.username}
          </div>
        </div>

        {post.user.id === user?.id && (
          <button type="button" onClick={async () => {
            if (!token || !id || !window.confirm("تحذف هذا المنشور؟")) return;
            try {
              const res = await fetch(`${API_URL}/posts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
              if (!res.ok) throw new Error();
              navigate("/");
            } catch { setError("تعذر حذف المنشور."); }
          }} style={{ marginTop: 14, color: "#c00", border: "1px solid #f0cccc", borderRadius: 10, padding: "8px 12px", background: "#fff" }}>
            حذف المنشور
          </button>
        )}

        {post.content && (
          <div
            style={{
              marginTop: 16,
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
            }}
          >
            {post.content}
          </div>
        )}

        {post.mediaUrl && (
          <div style={{ marginTop: 16 }}>
            {post.mediaType === "video" ? (
              <VideoPlayer src={post.mediaUrl} poster={undefined} />
            ) : (
              <img src={post.mediaUrl} alt="" style={{ width: "100%", borderRadius: 14, display: "block" }} />
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid #eee",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => void toggleLike()}
            disabled={liking}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "9px 14px",
              background: likedByMe ? "#fff0f0" : "#fff",
              color: likedByMe ? "#d00" : "#333",
              cursor: liking ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {likedByMe ? "❤️ أعجبني" : "♡ إعجاب"}
          </button>

          <span>{likeCount} إعجاب</span>
        </div>
      </article>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 12 }}>التعليقات</h2>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 18,
          }}
        >
          <input
            value={commentText}
            onChange={(event) =>
              setCommentText(event.target.value)
            }
            placeholder="اكتب تعليقك..."
            disabled={sending}
            style={{
              flex: 1,
              minWidth: 0,
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: "11px 13px",
              fontFamily: "inherit",
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void addComment();
              }
            }}
          />

          <button
            type="button"
            onClick={() => void addComment()}
            disabled={sending || !commentText.trim()}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "0 16px",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {sending ? "..." : "نشر"}
          </button>
        </div>

        {rootComments.length === 0 ? (
          <div style={{ color: "#777" }}>
            لا توجد تعليقات بعد.
          </div>
        ) : (
          rootComments.map((comment) =>
            renderComment(comment),
          )
        )}
      </section>
    </main>
  );
}
