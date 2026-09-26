import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

export default function CreatePostPage() {
  const { token } = useAuth();
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

  if (!token) return <main className="feed-container"><section className="stories-card"><div style={{padding:30,textAlign:"center"}}>يجب تسجيل الدخول لإنشاء منشور.</div></section></main>;

  return (
    <main className="feed-container">
      <section className="stories-card">
        <form onSubmit={handleSubmit} style={{padding:24,display:"grid",gap:16}}>
          <div>
            <h1 style={{margin:0}}>إنشاء منشور</h1>
            <p style={{color:"#777",marginTop:8}}>شارك صورة، ريلز، أو نص.</p>
          </div>

          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="شنو تريد تنشر؟" maxLength={5000} rows={6} disabled={sending}
            style={{width:"100%",boxSizing:"border-box",resize:"vertical",padding:16,border:"1px solid #ddd",borderRadius:14,fontFamily:"inherit",fontSize:16}} />

          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={chooseMedia} hidden />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} style={{padding:12,border:"1px solid #ddd",borderRadius:12}}>
            {mediaType === "video" ? "🎬 تغيير الريلز" : mediaType === "image" ? "🖼️ تغيير الصورة" : "🖼️ إضافة صورة أو ريلز"}
          </button>

          {mediaUrl && mediaType === "image" && <img src={mediaUrl} alt="معاينة" style={{width:"100%",maxHeight:500,objectFit:"contain",borderRadius:14}} />}
          {mediaUrl && mediaType === "video" && <video src={mediaUrl} controls style={{width:"100%",maxHeight:500,borderRadius:14}} />}

          {error && <p style={{color:"#c00",margin:0}}>{error}</p>}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <span style={{color:"#777",fontSize:13}}>{content.length}/5000</span>
            <button type="submit" disabled={sending || (!content.trim() && !mediaUrl)} style={{border:0,borderRadius:12,padding:"12px 22px",background:"#111",color:"#fff",opacity:sending || (!content.trim() && !mediaUrl) ? .5 : 1}}>
              {sending ? "جاري النشر..." : "نشر"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
