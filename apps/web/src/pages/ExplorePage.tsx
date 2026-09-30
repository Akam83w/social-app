import OptimizedImage from "../components/OptimizedImage";
import { API_URL, writeCache } from "../lib/api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "../components/VideoPlayer";


type UserResult = { id:string; username:string; displayName:string|null; avatarUrl:string|null; isPrivate:boolean };
type Post = { id:string; content:string|null; mediaUrl:string|null; mediaType:string|null; mediaPoster?:string|null; createdAt:string; likeCount:number; user:{username:string;displayName:string|null;avatarUrl:string|null} };

export default function ExplorePage() {
  const { token } = useAuth();
  const [query,setQuery]=useState(""); const [mode,setMode]=useState<"users"|"hashtag">("users");
  const [users,setUsers]=useState<UserResult[]>([]); const [posts,setPosts]=useState<Post[]>([]); const [explore,setExplore]=useState<Post[]>([]);
  const [loading,setLoading]=useState(true); const [searching,setSearching]=useState(false); const [error,setError]=useState("");
  const key = "explore:public";

  async function loadExplore() {
    if (!token) return; setLoading(true); setError("");
    try { const r=await fetch(API_URL+"/posts/explore?limit=30",{headers:{Authorization:"Bearer "+token}}); const d=await r.json(); if(!r.ok) throw new Error(); const next=d.posts??[]; setExplore(next); writeCache(key,{posts:next}); }
    catch { setError("تعذر تحميل الاستكشاف."); } finally { setLoading(false); }
  }
  useEffect(()=>{void loadExplore();},[token]);

  async function search(e:React.FormEvent) {
    e.preventDefault(); if(!token) return; const value=query.trim(); if(!value)return;
    setSearching(true); setError(""); setUsers([]); setPosts([]);
    try {
      if(mode==="users"){const r=await fetch(API_URL+"/auth/search?q="+encodeURIComponent(value),{headers:{Authorization:"Bearer "+token}});const d=await r.json();if(!r.ok)throw new Error();setUsers(d.users??[]);}
      else {const tag=value.replace(/^#/,"");const r=await fetch(API_URL+"/posts/hashtag/"+encodeURIComponent(tag),{headers:{Authorization:"Bearer "+token}});const d=await r.json();if(!r.ok)throw new Error();setPosts(d.posts??[]);}
    } catch { setError(mode==="users"?"تعذر تنفيذ بحث المستخدمين.":"تعذر البحث بالهاشتاق."); } finally {setSearching(false);}
  }

  const cards=(items:Post[])=> <div className="explore-grid">{items.map(post=><article className="explore-card" key={post.id}>
    <Link to={"/u/"+encodeURIComponent(post.user.username)} className="explore-user"><OptimizedImage src={post.user.avatarUrl||"https://ui-avatars.com/api/?name="+encodeURIComponent(post.user.username)} alt=""/><span>{post.user.displayName||post.user.username}</span></Link>
    {post.mediaUrl?(post.mediaType==="video"?<VideoPlayer src={post.mediaUrl} poster={post.mediaPoster} />:<OptimizedImage src={post.mediaUrl} alt=""/>):<div className="explore-text-post">{post.content}</div>}
    {post.content&&post.mediaUrl&&<p>{post.content}</p>}<small>{new Date(post.createdAt).toLocaleString("ar-IQ")} · ♥ {post.likeCount||0}</small>
  </article>)}</div>;

  return <main className="feed-container"><section className="stories-card explore-page">
    <div className="explore-head"><h1>استكشاف</h1><span>بحث ومحتوى عام</span></div>
    <form className="explore-search" onSubmit={search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={mode==="users"?"اسم المستخدم أو الاسم":"#الهاشتاق"}/><button type="submit" disabled={searching||!query.trim()}>{searching?"جاري...":"بحث"}</button></form>
    <div className="explore-tabs"><button className={mode==="users"?"active":""} onClick={()=>setMode("users")} type="button">مستخدمون</button><button className={mode==="hashtag"?"active":""} onClick={()=>setMode("hashtag")} type="button">هاشتاق</button></div>
    {error&&<p className="search-error">{error}</p>}
    {mode==="users"&&users.length>0&&<div className="explore-users">{users.map(u=><Link to={"/u/"+encodeURIComponent(u.username)} className="explore-user-row" key={u.id}><OptimizedImage src={u.avatarUrl||"https://ui-avatars.com/api/?name="+encodeURIComponent(u.username)} alt=""/><div><strong>{u.displayName||u.username}</strong><span>@{u.username}{u.isPrivate?" · 🔒 خاص":""}</span></div></Link>)}</div>}
    {mode==="hashtag"&&posts.length>0&&cards(posts)}
    {!searching&&mode==="users"&&query.trim()&&!users.length&&!error&&<p className="explore-empty">ماكو مستخدمين مطابقين.</p>}
    {!searching&&mode==="hashtag"&&query.trim()&&!posts.length&&!error&&<p className="explore-empty">ماكو منشورات بهذا الهاشتاق.</p>}
  </section>
  <section className="stories-card explore-public-section"><div className="explore-head"><h2>منشورات عامة</h2><span>الأحدث أولاً</span></div>{loading?<p>جاري تحميل الاستكشاف...</p>:explore.length?cards(explore):<p className="explore-empty">ماكو منشورات عامة حالياً.</p>}</section>
  </main>;
}
