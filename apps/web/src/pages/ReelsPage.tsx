import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HeartIcon, CommentIcon, SendIcon } from "../components/icons/Icons";
import { apiRequest, likePost, unlikePost } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Reel = { id:string; content:string|null; mediaUrl:string|null; mediaType:string|null; likeCount:number; likedByMe:boolean; user:{id:string;username:string;displayName:string|null;avatarUrl:string|null} };

export default function ReelsPage(){
  const {token}=useAuth(); const [reels,setReels]=useState<Reel[]>([]); const [index,setIndex]=useState(0); const [error,setError]=useState("");
  const touchStart=useRef<number|null>(null); const tapTimer=useRef<number|null>(null); const tapCount=useRef(0);
  useEffect(()=>{ if(!token)return; apiRequest("/posts",token).then((d)=>setReels((d.posts??[]).filter((p:Reel)=>p.mediaType==="video"))).catch(()=>setError("تعذر تحميل الريلز.")); },[token]);
  const move=(delta:number)=>setIndex(i=>Math.max(0,Math.min(reels.length-1,i+delta)));
  const toggleLike=async()=>{const r=reels[index]; if(!r||!token)return; try{if(r.likedByMe){await unlikePost(r.id,token);setReels(a=>a.map(x=>x.id===r.id?{...x,likedByMe:false,likeCount:Math.max(0,x.likeCount-1)}:x));}else{await likePost(r.id,token);setReels(a=>a.map(x=>x.id===r.id?{...x,likedByMe:true,likeCount:x.likeCount+1}:x));}}catch{}}
  const handleTap=()=>{tapCount.current+=1;if(tapCount.current===1){tapTimer.current=window.setTimeout(()=>{tapCount.current=0;const v=document.querySelector<HTMLVideoElement>(`video[data-reel="${reels[index]?.id}"]`);if(v){if(v.paused)void v.play();else v.pause();}},260);}else{if(tapTimer.current)window.clearTimeout(tapTimer.current);tapCount.current=0;void toggleLike();}};
  if(error)return <main className="reels-screen"><div className="reels-empty">{error}</div></main>;
  if(!reels.length)return <main className="reels-screen"><div className="reels-empty">ماكو ريلز منشورة حالياً.</div></main>;
  const r=reels[index];
  return <main className="reels-screen" onTouchStart={e=>{touchStart.current=e.touches[0].clientY}} onTouchEnd={e=>{if(touchStart.current===null)return;const d=touchStart.current-e.changedTouches[0].clientY;touchStart.current=null;if(Math.abs(d)>60)move(d>0?1:-1)}} onWheel={e=>{if(Math.abs(e.deltaY)>40)move(e.deltaY>0?1:-1)}}>
    <div className="reel-full-card">
      <video key={r.id} data-reel={r.id} className="reel-full-video" src={r.mediaUrl||undefined} autoPlay playsInline loop preload="auto" onError={()=>setError("تعذر تشغيل هذا الريلز.")} onClick={handleTap}/>
      <div className="reel-gradient" />
      <Link to={`/u/${encodeURIComponent(r.user.username)}`} className="reel-full-user"><img src={r.user.avatarUrl||`https://ui-avatars.com/api/?name=${encodeURIComponent(r.user.username)}`} alt=""/><strong>{r.user.displayName||r.user.username}</strong></Link>
      <div className="reel-full-caption">{r.content}</div>
      <div className="reel-side-actions">
        <button onClick={()=>void toggleLike()} className={r.likedByMe?"reel-action liked":"reel-action"}><HeartIcon filled={r.likedByMe}/><span>{r.likeCount}</span></button>
        <Link to={`/post/${r.id}#comments`} className="reel-action"><CommentIcon/><span>تعليق</span></Link>
        <button className="reel-action" onClick={()=>navigator.clipboard?.writeText(`${window.location.origin}/post/${r.id}`)}><SendIcon/><span>مشاركة</span></button>
      </div>
      <div className="reel-counter">{index+1} / {reels.length}</div>
    </div>
  </main>;
}
