import OptimizedImage from "../components/OptimizedImage";

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("IMAGE_PROCESSING_FAILED");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest, API_URL, uploadVideo } from "../lib/api";
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
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStage, setVideoStage] = useState("");
  const [videoElapsed, setVideoElapsed] = useState(0);

  useEffect(() => {
    if (!sending || !videoFile) return;
    const started = Date.now();
    const timer = window.setInterval(() => setVideoElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [sending, videoFile]);

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
    compressImage(file).then(async (dataUrl) => {
      try {
        if (!token) throw new Error("UNAUTHORIZED");
        const blob = await (await fetch(dataUrl)).blob();
        const form = new FormData();
        form.append("file", blob, file.name.replace(/\.[^.]+$/, "") + ".webp");
        const response = await fetch(`${API_URL}/posts/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || "IMAGE_UPLOAD_FAILED");
        setMediaUrl(json.mediaUrl);
        setError("");
      } catch (error) {
        setMediaUrl("");
        setError(error instanceof Error && error.message === "IMAGE_STORAGE_NOT_CONFIGURED" ? "تخزين الصور غير مفعّل على السيرفر" : "تعذر رفع الصورة");
      }
    }).catch(() => setError("تعذر ضغط الصورة"));
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
      setVideoProgress(0);
      setVideoStage("");
      setVideoElapsed(0);

      if (videoFile) {
        const form = new FormData();
        form.append("content", content.trim());
        form.append("file", videoFile, videoFile.name);
        setVideoProgress(0);
        setVideoStage("جاري رفع الفيديو من الهاتف إلى السيرفر...");
        const json = await uploadVideo("/posts/video", token, form, setVideoProgress, () => {
          setVideoStage("تم رفع الملف، جاري معالجة الفيديو وإنشاء الجودات...");
        }) as { error?: string; post?: { id: string } };
        if (!json.post?.id) throw new Error("VIDEO_PROCESSING_FAILED");
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
      setVideoStage("");
      setError(
        err instanceof Error && err.message === "VIDEO_API_INVALID_RESPONSE"
          ? "سيرفر الفيديو رجّع استجابة غير صحيحة"
          : err instanceof Error
            ? err.message
            : "تعذر نشر المنشور"
      );
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
            <OptimizedImage src={user?.avatarUrl || "https://ui-avatars.com/api/?name=User&background=078968&color=fff"} alt="" />
            <div><strong>{user?.displayName || user?.username || "حسابك"}</strong><span>@{user?.username || "user"}</span></div>
            <span className="create-visibility">🌐 عام</span>
          </div>
          <textarea className="create-textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="شنو ببالك؟" maxLength={5000} disabled={sending} autoFocus />
          {(mediaUrl || videoPreview) && <div className="create-media-preview">
            {videoPreview ? <VideoPlayer src={videoPreview} controls muted className="post-video" /> : <OptimizedImage src={mediaUrl} alt="معاينة المنشور" />}
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
            <button className="create-submit" type="submit" disabled={sending || (!content.trim() && !mediaUrl && !videoFile)}>{sending ? (videoFile ? `${videoStage || "جاري تجهيز الفيديو..."}${videoProgress > 0 && videoProgress < 100 ? ` ${videoProgress}%` : ""}${videoElapsed ? ` · ${videoElapsed}ث` : ""}` : "جاري النشر...") : "نشر الآن"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
