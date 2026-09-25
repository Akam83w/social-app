import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

export default function CreatePostPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = content.trim();

    if (!text || !token || sending) return;

    try {
      setSending(true);
      setError("");

      const response = await apiRequest("/posts", token, {
        method: "POST",
        body: JSON.stringify({
          content: text,
        }),
      }) as {
        post: {
          id: string;
        };
      };

      navigate(`/post/${response.post.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر نشر المنشور",
      );
    } finally {
      setSending(false);
    }
  }

  if (!token) {
    return (
      <main className="feed-container">
        <section className="stories-card">
          <div style={{ padding: 30, textAlign: "center" }}>
            يجب تسجيل الدخول لإنشاء منشور.
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="feed-container">
      <section className="stories-card">
        <form
          onSubmit={handleSubmit}
          style={{
            padding: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>إنشاء منشور</h1>
            <p style={{ color: "#777", marginTop: 8 }}>
              شارك شيئًا مع الناس.
            </p>
          </div>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="شنو تريد تنشر؟"
            maxLength={5000}
            rows={8}
            disabled={sending}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 14,
              fontFamily: "inherit",
              fontSize: 16,
              outline: "none",
            }}
          />

          {error && (
            <p style={{ color: "#c00", margin: 0 }}>
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ color: "#777", fontSize: 13 }}>
              {content.length}/5000
            </span>

            <button
              type="submit"
              disabled={!content.trim() || sending}
              style={{
                border: 0,
                borderRadius: 12,
                padding: "12px 22px",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                opacity:
                  content.trim() && !sending ? 1 : 0.5,
              }}
            >
              {sending ? "جاري النشر..." : "نشر"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
