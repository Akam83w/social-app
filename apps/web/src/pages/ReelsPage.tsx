import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "../components/VideoPlayer";

type Reel = { id:string; content:string|null; mediaUrl:string|null; mediaType:string|null; mediaPoster?:string|null; likeCount:number; user:{username:string;displayName:string|null;avatarUrl:string|null} };

const PAGE_SIZE = 10;

export default function ReelsPage() {
  const { token } = useAuth();
  const [reels,setReels] = useState<Reel[]>([]);
  const [nextCursor,setNextCursor] = useState<string|null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const loadingRef = useRef(false);

  const loadMore = useCallback(async (cursor:string|null, replace=false) => {
    if(!token || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const query = cursor ? `/reels?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}` : `/reels?limit=${PAGE_SIZE}`;
      const data = await apiRequest(query,token);
      const incoming = (data.reels ?? []) as Reel[];
      setReels(prev => {
        const merged = replace ? incoming : [...prev, ...incoming];
        const seen = new Set<string>();
        return merged.filter(item => !seen.has(item.id) && seen.add(item.id));
      });
      setNextCursor(data.nextCursor ?? null);
      setError("");
    } catch {
      setError("تعذر تحميل الفيديوهات.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  },[token]);

  useEffect(() => {
    setReels([]);
    setNextCursor(null);
    if(token) void loadMore(null,true);
  },[token,loadMore]);

  useEffect(() => {
    const onScroll = () => {
      if(!nextCursor || loadingRef.current || reels.length < 3) return;
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - window.innerHeight * 2;
      if(nearBottom) void loadMore(nextCursor);
    };
    window.addEventListener("scroll",onScroll,{passive:true});
    return () => window.removeEventListener("scroll",onScroll);
  },[nextCursor,reels.length,loadMore]);

  return <main className="feed-container"><section className="stories-card">
    <div className="section-heading"><div><h2>الفيديوهات</h2><p>فيديوهات SDM بجودة تتكيف مع سرعة الاتصال.</p></div><Link to="/create">إنشاء فيديو</Link></div>
    {error&&<p className="search-error">{error}</p>}
    {!error&&!reels.length&&!loading&&<div className="reels-empty">ماكو فيديوهات منشورة حالياً.</div>}
    <div className="reels-list">{reels.map(r=><article className="reel-card" key={r.id}>
      <Link to={"/u/"+encodeURIComponent(r.user.username)} className="explore-user"><img src={r.user.avatarUrl||"https://ui-avatars.com/api/?name="+encodeURIComponent(r.user.username)} alt=""/><span>{r.user.displayName||r.user.username}</span></Link>
      {r.mediaUrl&&<VideoPlayer src={r.mediaUrl} poster={r.mediaPoster} className="post-video" controls/>}
      {r.content&&<p>{r.content}</p>}<small>♥ {r.likeCount||0}</small>
    </article>)}</div>
    {loading&&<div className="reels-empty">جاري تحميل المزيد...</div>}
    {!loading&&!nextCursor&&reels.length>0&&<div className="reels-empty">وصلت إلى نهاية الفيديوهات.</div>}
  </section></main>;
}
