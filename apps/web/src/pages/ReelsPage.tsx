import OptimizedImage from "../components/OptimizedImage";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "../components/VideoPlayer";

type Reel = { id:string; content:string|null; mediaUrl:string|null; mediaType:string|null; mediaPoster?:string|null; likeCount:number; user:{username:string;displayName:string|null;avatarUrl:string|null} };

function ReelItem({ reel }: { reel: Reel }) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting && entry.intersectionRatio >= 0.65), {
      threshold: [0.25, 0.65, 0.9],
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <article ref={ref} className="reel-screen">
    <div className="reel-media">
      {reel.mediaUrl && <VideoPlayer src={reel.mediaUrl} poster={reel.mediaPoster} className="reel-video" controls={false} muted autoPlay={active} />}
      <div className="reel-gradient" />
      <div className="reel-top">
        <Link to={"/u/"+encodeURIComponent(reel.user.username)} className="reel-user">
          <OptimizedImage src={reel.user.avatarUrl||"https://ui-avatars.com/api/?name="+encodeURIComponent(reel.user.username)} alt=""/>
          <strong>{reel.user.displayName||reel.user.username}</strong>
        </Link>
      </div>
      <div className="reel-bottom">
        <div className="reel-caption">
          {reel.content&&<p>{reel.content}</p>}
        </div>
        <div className="reel-actions">
          <button type="button" aria-label="إعجاب">♥<span>{reel.likeCount||0}</span></button>
          <button type="button" aria-label="تعليق">💬</button>
          <button type="button" aria-label="مشاركة">↗</button>
        </div>
      </div>
    </div>
  </article>;
}

export default function ReelsPage() {
  const { token } = useAuth();
  const [reels,setReels] = useState<Reel[]>([]);
  const [error,setError] = useState("");

  useEffect(() => {
    if(!token) return;
    apiRequest("/posts?limit=50",token)
      .then((d:any)=>setReels((d.posts??[]).filter((p:Reel)=>p.mediaType==="video")))
      .catch(()=>setError("تعذر تحميل الريلز."));
  },[token]);

  return <main className="reels-feed">
    <div className="reels-header"><strong>ريلز</strong><Link to="/create">＋</Link></div>
    {error&&<div className="reels-error">{error}</div>}
    {!error&&!reels.length&&<div className="reels-empty">ماكو ريلز منشورة حالياً.</div>}
    <div className="reels-list">{reels.map(r=><ReelItem key={r.id} reel={r}/>)}</div>
  </main>;
}
