import { useEffect,useState } from "react";
import { Link,useParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Post={id:string;content:string;mediaUrl?:string|null;createdAt:string;likeCount?:number;commentCount?:number;likedByMe?:boolean;author?:{username?:string;displayName?:string|null;avatarUrl?:string|null}};

export default function HashtagPage(){
 const {token}=useAuth(); const {tag=""}=useParams(); const [posts,setPosts]=useState<Post[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 useEffect(()=>{if(!token)return;let alive=true;setLoading(true);setError("");apiRequest("/posts/hashtag/"+encodeURIComponent(tag),token).then(d=>{if(alive)setPosts(d.posts||[])}).catch(()=>{if(alive)setError("تعذر تحميل المنشورات.")}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[token,tag]);
 return <main className="feed-container"><section className="stories-card"><div style={{padding:20}}><h1 style={{marginTop:0}}>#{tag}</h1>{loading&&<p>جاري التحميل...</p>}{error&&<p className="search-error">{error}</p>}{!loading&&!error&&!posts.length&&<p>لا توجد منشورات بهذا الوسم.</p>}<div className="post-list">{posts.map(post=><article className="post-card" key={post.id}><header><Link to={"/u/"+encodeURIComponent(post.author?.username||"")}><strong>{post.author?.displayName||post.author?.username||"مستخدم"}</strong></Link><small>{new Date(post.createdAt).toLocaleString("ar-IQ")}</small></header><p>{post.content}</p>{post.mediaUrl&&<img src={post.mediaUrl} alt="" style={{width:"100%",borderRadius:12,maxHeight:520,objectFit:"cover"}}/>}<footer><span>♥ {post.likeCount||0}</span><span>💬 {post.commentCount||0}</span></footer></article>)}</div></div></section></main>
}