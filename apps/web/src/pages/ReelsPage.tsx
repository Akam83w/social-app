import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HeartIcon, CommentIcon, SendIcon, BookmarkIcon } from "../components/icons/Icons";
import { apiRequest, createComment, getPostComments, likePost, unlikePost } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type BadgeUser = {
  id:string; username:string; displayName:string|null; avatarUrl:string|null;
  supporterNumber:string|null; supporterExpiresAt:string|null; verifiedAt:string|null; isFounder:boolean;
};
type Reel = {
  id:string; content:string|null; mediaUrl:string|null; mediaType:string|null; likeCount:number; likedByMe:boolean; user:BadgeUser;
};
type Comment = { id:string; parentCommentId:string|null; content:string; createdAt:string; user:BadgeUser; };

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function BadgeName({ user }: { user: BadgeUser }) {
  const supporter = Boolean(user.supporterNumber && user.supporterExpiresAt && new Date(user.supporterExpiresAt).getTime() > Date.now());
  return <span className={supporter ? "supporter-name" : ""}>
    {user.displayName || user.username}
    {user.isFounder && <span className="founder-star-inline" title="مؤسس SDM">★</span>}
    {!user.isFounder && supporter && <span className="supporter-star" title={"داعم مؤسس #" + user.supporterNumber}>★</span>}
    {user.verifiedAt && <span className="real-verified" title="حساب موثّق">✓</span>}
  </span>;
}

export default function ReelsPage() {
  const { token, user } = useAuth();
  const [reels,setReels]=useState<Reel[]>([]);
  const [index,setIndex]=useState(0);
  const [error,setError]=useState("");
  const [commentsOpen,setCommentsOpen]=useState(false);
  const [comments,setComments]=useState<Comment[]>([]);
  const [commentText,setCommentText]=useState("");
  const [commentsLoading,setCommentsLoading]=useState(false);
  const [commentSending,setCommentSending]=useState(false);
  const [followed,setFollowed]=useState<Record<string,boolean>>({});
  const [saving,setSaving]=useState<Record<string,boolean>>({});
  const touchStart=useRef<number|null>(null);

  useEffect(()=>{if(!token)return;apiRequest("/posts?limit=50",token).then((d)=>setReels((d.posts??[]).filter((p:Reel)=>p.mediaType==="video"))).catch(()=>setError("تعذر تحميل الفيديوهات."));},[token]);

  const current=reels[index];
  const move=(delta:number)=>setIndex(i=>Math.max(0,Math.min(reels.length-1,i+delta)));

  const toggleLike=async()=>{if(!current||!token)return;try{if(current.likedByMe)await unlikePost(current.id,token);else await likePost(current.id,token);setReels(a=>a.map(x=>x.id===current.id?{...x,likedByMe:!x.likedByMe,likeCount:Math.max(0,x.likeCount+(x.likedByMe?-1:1))}:x));}catch{setError("تعذر تحديث الإعجاب.");}};

  const openComments=async()=>{if(!current||!token)return;setCommentsOpen(true);setCommentsLoading(true);try{const d=await getPostComments(current.id,token) as {comments:Comment[]};setComments(d.comments??[]);}catch{setComments([]);}finally{setCommentsLoading(false);}};

  const sendComment=async()=>{const text=commentText.trim();if(!current||!token||!text||commentSending)return;setCommentSending(true);try{const d=await createComment(current.id,text,token) as {comment:{id:string;parentCommentId:string|null;content:string;createdAt:string}};if(user)setComments(a=>[...a,{...d.comment,user:{id:user.id,username:user.username,displayName:user.displayName||null,avatarUrl:user.avatarUrl||null,supporterNumber:user.supporterNumber||null,supporterExpiresAt:user.supporterExpiresAt||null,verifiedAt:user.verifiedAt||null,isFounder:user.email?.toLowerCase()==="sdmtr033@gmail.com"}}]);setCommentText("");}catch{setError("تعذر نشر التعليق.");}finally{setCommentSending(false);}};

  const toggleFollow=async()=>{if(!current||!token||current.user.id===user?.id)return;const isFollowing=Boolean(followed[current.user.id]);try{const res=await fetch(API_URL+"/auth/users/"+encodeURIComponent(current.user.username)+"/follow",{method:isFollowing?"DELETE":"POST",headers:{Authorization:"Bearer "+token}});if(!res.ok)throw new Error();setFollowed(a=>({...a,[current.user.id]:!isFollowing}));}catch{setError("تعذر تحديث المتابعة.");}};

  const toggleSave=()=>{if(!current)return;const key="sdm_saved_"+current.id;const next=!saving[current.id];if(next)localStorage.setItem(key,"1");else localStorage.removeItem(key);setSaving(a=>({...a,[current.id]:next}));};

  const share=async()=>{if(!current)return;const url=window.location.origin+"/post/"+current.id;try{if(navigator.share)await navigator.share({title:current.user.displayName||current.user.username,text:current.content||"شوف هذا الفيديو على إنستعراق",url});else{await navigator.clipboard?.writeText(url);setError("تم نسخ رابط الفيديو.");setTimeout(()=>setError(""),1800);}}catch{}};

  if(error&&!reels.length)return <main className="reels-screen"><div className="reels-empty">{error}</div></main>;
  if(!reels.length)return <main className="reels-screen"><div className="reels-empty">ماكو فيديوهات منشورة حالياً.</div></main>;

  const isSaved=Boolean(saving[current.id]);
  return <main className="reels-screen"
    onTouchStart={e=>{touchStart.current=e.touches[0].clientY}}
    onTouchEnd={e=>{if(touchStart.current===null)return;const d=touchStart.current-e.changedTouches[0].clientY;touchStart.current=null;if(Math.abs(d)>55)move(d>0?1:-1)}}
    onWheel={e=>{if(Math.abs(e.deltaY)>40)move(e.deltaY>0?1:-1)}}
  >
    <div className="reel-full-card">
      <video key={current.id} className="reel-full-video" src={current.mediaUrl||undefined} autoPlay playsInline loop controls={false} onClick={e=>{const v=e.currentTarget;if(v.paused)void v.play();else v.pause();}} />
      <div className="reel-gradient"/>
      <div className="reel-topbar"><strong>الفيديوهات</strong><span>{index+1} / {reels.length}</span></div>
      <div className="reel-full-user">
        <Link to={"/u/"+encodeURIComponent(current.user.username)} className="reel-user-link">
          <img src={current.user.avatarUrl||("https://ui-avatars.com/api/?name="+encodeURIComponent(current.user.username))} alt=""/>
          <span><strong><BadgeName user={current.user}/></strong><small>@{current.user.username}</small></span>
        </Link>
        {current.user.id!==user?.id&&<button className={followed[current.user.id]?"reel-follow following":"reel-follow"} onClick={()=>void toggleFollow()}>{followed[current.user.id]?"متابَع":"متابعة"}</button>}
      </div>
      {current.content&&<div className="reel-full-caption">{current.content}</div>}
      <div className="reel-side-actions">
        <button onClick={()=>void toggleLike()} className={current.likedByMe?"reel-action liked":"reel-action"}><HeartIcon filled={current.likedByMe}/><span>{current.likeCount}</span></button>
        <button onClick={()=>void openComments()} className="reel-action"><CommentIcon/><span>تعليق</span></button>
        <button onClick={()=>void share()} className="reel-action"><SendIcon/><span>مشاركة</span></button>
        <button onClick={toggleSave} className={isSaved?"reel-action saved":"reel-action"}><BookmarkIcon/><span>{isSaved?"محفوظ":"حفظ"}</span></button>
      </div>
      {error&&<div className="reel-toast">{error}</div>}
    </div>
    {commentsOpen&&<div className="reel-comments-backdrop" onClick={()=>setCommentsOpen(false)}>
      <section className="reel-comments-sheet" onClick={e=>e.stopPropagation()}>
        <header><strong>التعليقات</strong><button onClick={()=>setCommentsOpen(false)}>×</button></header>
        <div className="reel-comments-list">
          {commentsLoading?<p>جاري تحميل التعليقات...</p>:comments.length===0?<p className="reel-no-comments">كن أول من يعلّق.</p>:comments.map(c=><article key={c.id}><img src={c.user.avatarUrl||("https://ui-avatars.com/api/?name="+encodeURIComponent(c.user.username))} alt=""/><div><strong><BadgeName user={c.user}/></strong><small>@{c.user.username}</small><p>{c.content}</p></div></article>)}
        </div>
        <div className="reel-comment-form"><input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="اكتب تعليقك..." onKeyDown={e=>{if(e.key==="Enter")void sendComment()}}/><button disabled={!commentText.trim()||commentSending} onClick={()=>void sendComment()}>{commentSending?"...":"نشر"}</button></div>
      </section>
    </div>}
  </main>;
}
