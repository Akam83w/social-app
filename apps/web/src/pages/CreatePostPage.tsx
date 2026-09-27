import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

export default function CreatePostPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "">("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function chooseMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("اختار صورة أو فيديو فقط");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setError("الملف كبير. اختار ملف أقل من 1.5 ميگابايت حالياً");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMediaUrl(String(reader.result));
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
      setError("");
    };
    reader.onerror = () => setError("تعذر قراءة الملف");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || sending || (!content.trim() && !mediaUrl)) return;
    try {
      setSending(true);
      setError("");
      const response = await apiRequest("/posts", token, {
        method: "POST",
        body: JSON.stringify({
          content: content.trim() || undefined,
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaType || undefined,
        }),
      }) as { post: { id: string } };
      navigate(`/post/${response.post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر نشر المنشور");
    } finally {
      setSending(false);
    }
  }

  if (!token) {
    return <main className="feed-container"><section className="create-post-page"><div className="create-login-state"><strong>سجّل دخولك أولاً</strong><p>حتى تگدر تكتب وتنشر على SDM.</p><Link to="/login">تسجيل الدخول</Link></div></section></main>;
  }

  return (
    <main className="feed-container">
      <section className="create-post-page">
        <header className="create-post-header">
          <Link to="/" className="create-back" aria-label="رجوع">‹</Link>
          <div><h1>إنشاء منشور</h1><p>شارك لحظتك ويا مجتمع SDM</p></div>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="create-author">
            <img src={user?.avatarUrl || "https://ui-avatars.com/api/?name=User&background=078968&color=fff"} alt="" />
            <div><strong>{user?.displayName || user?.username || "حسابك"}</strong><span>@{user?.username || "user"}</span></div>
            <span className="create-visibility">🌐 عام</span>
          </div>

          <textarea
            className="create-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="شنو ببالك؟"
            maxLength={5000}
            disabled={sending}
            autoFocus
          />

          {mediaUrl && (
            <div className="create-media-preview">
              {mediaType === "video"
                ? <video src={mediaUrl} controls playsInline />
                : <img src={mediaUrl} alt="معاينة المنشور" />}
              <button type="button" className="create-remove-media" onClick={() => { setMediaUrl(""); setMediaType(""); }} disabled={sending}>×</button>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={chooseMedia} hidden />

          <div className="create-tools">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={sending}><span>▣</span><div><b>صورة أو فيديو</b><small>أضف وسائط لمنشورك</small></div><i>›</i></button>
            <Link to="/create-story"><span>◉</span><div><b>قصة</b><small>شاركها لمدة 24 ساعة</small></div><i>›</i></Link>
          </div>

          <div className="create-bottom">
            <span className="create-counter">{content.length.toLocaleString("ar-IQ")} / ٥٠٠٠</span>
            {error && <p className="create-error">{error}</p>}
            <button className="create-submit" type="submit" disabled={sending || (!content.trim() && !mediaUrl)}>
              {sending ? "جاري النشر..." : "نشر الآن"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
