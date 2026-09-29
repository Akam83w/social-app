import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "../components/VideoPlayer";

type Reel = { id:string; content:string|null; mediaUrl:string|null; mediaType:string|null; mediaPoster?:string|null; likeCount:number; user:{username:string;displayName:string|null;avatarUrl:string|null} };

export default function ReelsPage() {
  const { token } = useAuth();
  const [reels,setReels] = useState<Reel[]>([]);
  const [error,setError] = useState("");

  useEffect(() => {
    if(!token) return;
    apiRequest("/posts?limit=50",token)
      .then((d:any)=>setReels((d.posts??[]).filter((p:Reel)=>p.mediaType==="video")))
      .catch(()=>setError("تعذر تحميل الفيديوهات."));
  },[token]);

  return <main className="feed-container"><section className="stories-card">
    <div className="section-heading"><div><h2>الفيديوهات</h2><p>فيديوهات SDM بجودة تتكيف مع سرعة الاتصال.</p></div><Link to="/create">إنشاء فيديو</Link></div>
    {error&&<p className="search-error">{error}</p>}
    {!error&&!reels.length&&<div className="reels-empty">ماكو فيديوهات منشورة حالياً.</div>}
    <div className="reels-list">{reels.map(r=><article className="reel-card" key={r.id}>
      <Link to={"/u/"+encodeURIComponent(r.user.username)} className="explore-user"><img src={r.user.avatarUrl||"https://ui-avatars.com/api/?name="+encodeURIComponent(r.user.username)} alt=""/><span>{r.user.displayName||r.user.username}</span></Link>
      {r.mediaUrl&&<VideoPlayer src={r.mediaUrl} poster={r.mediaPoster} className="post-video" controls/>}
      {r.content&&<p>{r.content}</p>}<small>♥ {r.likeCount||0}</small>
    </article>)}</div>
  </section></main>;
}
