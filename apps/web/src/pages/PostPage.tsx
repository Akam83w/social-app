import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { posts } from "../data/posts";

type Comment = {
  id: number;
  username: string;
  text: string;
  likes: number;
  liked: boolean;
};

export default function PostPage() {
  const id = window.location.pathname.split("/").pop();
  const post = posts.find((item) => String(item.id) === id) ?? posts[0];

  const storageKey = `instaIraq_comments_${post.id}`;

  const [comments, setComments] = useState<Comment[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}

    return [
      {
        id: 1,
        username: "أحمد",
        text: "صورة جميلة ❤️",
        likes: 3,
        liked: false,
      },
      {
        id: 2,
        username: "سارة",
        text: "المكان رهيب!",
        likes: 1,
        liked: false,
      },
    ];
  });

  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(comments));
  }, [storageKey, comments]);

  function addComment() {
    const text = commentText.trim();

    if (!text) return;

    setComments((current) => [
      ...current,
      {
        id: Date.now(),
        username: "ذنون",
        text,
        likes: 0,
        liked: false,
      },
    ]);

    setCommentText("");
  }

  function toggleCommentLike(commentId: number) {
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              liked: !comment.liked,
              likes: comment.liked
                ? comment.likes - 1
                : comment.likes + 1,
            }
          : comment
      )
    );
  }

  function deleteComment(commentId: number) {
    setComments((current) =>
      current.filter((comment) => comment.id !== commentId)
    );
  }

  return (
    <main className="feed-container">
      <article className="post-card">
        <header className="post-header">
          <Link
            to={`/u/${encodeURIComponent(post.username)}`}
            className="post-user"
          >
            <img src={post.avatar} alt={post.username} />

            <div>
              <strong>{post.username}</strong>
              <span>{post.location}</span>
            </div>
          </Link>
        </header>

        <div className="post-media">
          <img src={post.image} alt={post.caption} />
        </div>

        <div className="post-content">
          <strong>
            {post.likes.toLocaleString("ar-IQ")} إعجاب
          </strong>

          <p>
            <b>{post.username}</b> {post.caption}
          </p>

          <div id="comments" style={{ marginTop: 28 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <strong>التعليقات ({comments.length})</strong>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addComment();
                  }
                }}
                placeholder="اكتب تعليقك..."
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  outline: "none",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              />

              <button
                onClick={addComment}
                disabled={!commentText.trim()}
                style={{
                  border: 0,
                  borderRadius: 12,
                  padding: "0 16px",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity: commentText.trim() ? 1 : 0.5,
                }}
              >
                إرسال
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    padding: 14,
                    border: "1px solid #eee",
                    borderRadius: 14,
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong>{comment.username}</strong>

                    {comment.username === "ذنون" && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#d00",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        حذف
                      </button>
                    )}
                  </div>

                  <p style={{ margin: "8px 0 10px" }}>
                    {comment.text}
                  </p>

                  <button
                    onClick={() => toggleCommentLike(comment.id)}
                    style={{
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {comment.liked ? "♥" : "♡"} {comment.likes}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
