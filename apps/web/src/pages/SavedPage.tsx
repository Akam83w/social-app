import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type SavedPost={id:string;content:string|null;mediaUrl:string|null;mediaType:string|null;likeCount:number;user:{username:string;displayName:string|null;avatarUrl:string|null}};
export default function SavedPage(){
  const {token}=useAuth(); const [posts,setPosts]=useState<SavedPost[]>([]);
  useEffect(()=>{if(!token)return;apiRequest("/posts?limit=50",token).then(d=>setPosts((d.posts??[]).filter((p:SavedPost)=>localStorage.getItem("sdm_saved_"+p.id)==="1"))).catch(()=>setPosts([]));},[token]);
  return <main className="feed-container"><section className="saved-page"><header><div><h1>المحفوظات</h1><p>الفيديوهات والمنشورات التي حفظتها.</p></div></header>{posts.length===0?<div className="saved-empty">ماكو منشورات محفوظة حالياً.</div>:<div className="saved-grid">{posts.map(p=><Link to={"/post/"+p.id} className="saved-card" key={p.id}>{p.mediaUrl&&(p.mediaType==="video"?<video src={p.mediaUrl} muted playsInline/>:<img src={p.mediaUrl} alt=""/>)}<div><strong>{p.user.displayName||p.user.username}</strong>{p.content&&<p>{p.content}</p>}</div></Link>)}</div>}</section></main>;
}
