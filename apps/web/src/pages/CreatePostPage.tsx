import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest, API_URL } from "../lib/api";
import VideoPlayer from "../components/VideoPlayer";

export default function CreatePostPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function chooseMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type.startsWith("video/")) {
      if (file.size > 100 * 1024 * 1024) {
        setError("الفيديو لازم يكون أقل من 100 ميگابايت حاليًا");
        return;
      }
      setMediaUrl("");
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setError("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("اختار صورة أو فيديو فقط.");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setError("الصورة لازم تكون أقل من 1.5 ميگابايت حاليًا");
      return;
    }
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview("");
    const reader = new FileReader();
    reader.onload = () => { setMediaUrl(String(reader.result)); setError(""); };
    reader.onerror = () => setError("تعذر قراءة الصورة");
    reader.readAsDataURL(file);
  }

  function clearMedia() {
    setMediaUrl("");
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || sending || (!content.trim() && !mediaUrl && !videoFile)) return;
    try {
      setSending(true);
      setError("");

      if (videoFile) {
        const form = new FormData();
        form.append("content", content.trim());
        form.append("file", videoFile, videoFile.name);
        const res = await fetch(`${API_URL}/posts/video`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "VIDEO_PROCESSING_FAILED");
        navigate(`/post/${json.post.id}`);
        return;
      }

      const response = await apiRequest("/posts", token, {
        method: "POST",
        body: JSON.stringify({
          content: content.trim() || undefined,
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaUrl ? "image" : undefined,
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
          <textarea className="create-textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="شنو ببالك؟" maxLength={5000} disabled={sending} autoFocus />
          {(mediaUrl || videoPreview) && <div className="create-media-preview">
            {videoPreview ? <VideoPlayer src={videoPreview} controls muted className="post-video" /> : <img src={mediaUrl} alt="معاينة المنشور" />}
            <button type="button" className="create-remove-media" onClick={clearMedia} disabled={sending}>×</button>
          </div>}
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={chooseMedia} hidden />
          <div className="create-tools">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={sending}><span>▣</span><div><b>إضافة صورة أو فيديو</b><small>الفيديو ينضغط تلقائيًا إلى جودات مناسبة</small></div><i>›</i></button>
            <Link to="/create-story"><span>◉</span><div><b>قصة</b><small>شاركها لمدة 24 ساعة</small></div><i>›</i></Link>
          </div>
          <div className="create-bottom">
            <span className="create-counter">{content.length.toLocaleString("ar-IQ")} / ٥٠٠٠</span>
            {error && <p className="create-error">{error}</p>}
            <button className="create-submit" type="submit" disabled={sending || (!content.trim() && !mediaUrl && !videoFile)}>{sending ? (videoFile ? "جاري ضغط الفيديو ونشره..." : "جاري النشر...") : "نشر الآن"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
