import { useEffect,useState,useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest,startCall,getActiveUsers,getMessageNotes,setMessageNote,deleteMessageNote,pingPresence,readCache,writeCache } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Message={id:string;content:string;createdAt:string;senderId:string;receiverId:string};
type ChatUser={id?:string;username:string;displayName:string|null;avatarUrl:string|null;verifiedAt?:string|null;supporterNumber?:string|null;supporterExpiresAt?:string|null;isFounder?:boolean};
type Chat={user:ChatUser;messages:Message[]};
type ActiveUser={id:string;username:string;displayName:string|null;avatarUrl:string|null;verifiedAt?:string|null;supporterNumber?:string|null;supporterExpiresAt?:string|null;isFounder?:boolean;isActive:boolean;note?:string|null;noteCreatedAt?:string|null;noteExpiresAt?:string|null};
type Note={user:{id:string;username:string;displayName:string|null;avatarUrl:string|null};content:string;createdAt:string;expiresAt:string;isActive:boolean};

const normMsg=(m:any):Message=>({id:String(m.id),content:String(m.content??""),createdAt:m.createdAt??m.created_at??new Date().toISOString(),senderId:String(m.senderId??m.sender_id??""),receiverId:String(m.receiverId??m.receiver_id??"")});
const sameDay=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const dayLabel=(d:Date)=>{const now=new Date();const y=new Date();y.setDate(now.getDate()-1);if(sameDay(d,now))return "اليوم";if(sameDay(d,y))return "أمس";return d.toLocaleDateString("ar-IQ",{day:"numeric",month:"long"});};
const clock=(iso:string)=>{const d=new Date(iso);if(isNaN(d.getTime()))return "";return d.toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"});};
const shortTime=(iso:string)=>{const d=new Date(iso);if(isNaN(d.getTime()))return "";const now=new Date();if(sameDay(d,now))return clock(iso);const diff=(now.getTime()-d.getTime())/86400000;if(diff<7)return d.toLocaleDateString("ar-IQ",{weekday:"short"});return d.toLocaleDateString("ar-IQ",{day:"numeric",month:"short"});};
type Row={kind:"day";key:string;label:string}|{kind:"msg";key:string;m:Message;mine:boolean;first:boolean;last:boolean};
const buildRows=(messages:Message[],myId?:string):Row[]=>{const rows:Row[]=[];messages.forEach((m,i)=>{const d=new Date(m.createdAt);const prev=messages[i-1];const next=messages[i+1];const newDay=!prev||!sameDay(new Date(prev.createdAt),d);if(newDay)rows.push({kind:"day",key:"d"+m.id,label:dayLabel(d)});const nextNewDay=next&&!sameDay(new Date(next.createdAt),d);const first=newDay||prev.senderId!==m.senderId;const last=!next||nextNewDay||next.senderId!==m.senderId;rows.push({kind:"msg",key:m.id,m,mine:m.senderId===myId,first,last});});return rows;};

export default function MessagesPage(){
 const {token,user}=useAuth(); const navigate=useNavigate(); const [params]=useSearchParams();
 const [chats,setChats]=useState<Chat[]>(()=>readCache<Chat[]>("messages")??[]); const [active,setActive]=useState<Chat|null>(null); const [text,setText]=useState("");
 const [username,setUsername]=useState(params.get("username")||""); const [error,setError]=useState("");
 const [activeUsers,setActiveUsers]=useState<ActiveUser[]>([]); const [notes,setNotes]=useState<Note[]>([]);
 const [noteOpen,setNoteOpen]=useState(false); const [noteText,setNoteText]=useState(""); const [noteSaving,setNoteSaving]=useState(false); const [loadingChat,setLoadingChat]=useState(false); const [loadingList,setLoadingList]=useState(()=>readCache<Chat[]>("messages")===null); const endRef=useRef<HTMLDivElement>(null); const composerRef=useRef<HTMLTextAreaElement>(null);

 const load=async()=>{if(!token)return;
  void apiRequest("/messages",token).then(ch=>{setChats(ch.chats??[]);writeCache("messages",ch.chats??[]);}).catch(()=>setError("تعذر تحميل الرسائل.")).finally(()=>setLoadingList(false));
  void getMessageNotes(token).then(n=>setNotes(n.notes??[])).catch(()=>{});
  void getActiveUsers(token).then(a=>setActiveUsers(a.users??[])).catch(()=>{});
 };
 const refreshPresence=async()=>{if(!token)return;try{const [n,a]=await Promise.all([getMessageNotes(token),getActiveUsers(token)]);setNotes(n.notes??[]);setActiveUsers(a.users??[]);}catch{}};
 const open=async(u:string)=>{if(!token||!u.trim())return;const clean=u.replace(/^@/,"").trim();const cached=chats.find(c=>c.user.username.toLowerCase()===clean.toLowerCase());const known=cached?.user||activeUsers.find(x=>x.username.toLowerCase()===clean.toLowerCase());if(cached){setActive({...cached,messages:(cached.messages??[]).map(normMsg)});setLoadingChat(false)}else{setActive({user:{id:known?.id,username:clean,displayName:known?.displayName||null,avatarUrl:known?.avatarUrl||null,verifiedAt:known?.verifiedAt||null,supporterNumber:known?.supporterNumber||null,supporterExpiresAt:known?.supporterExpiresAt||null,isFounder:known?.isFounder||false},messages:[]});setLoadingChat(true)}setUsername(clean);setError("");try{const d=await apiRequest(`/messages/${encodeURIComponent(clean)}`,token);const fresh={...d,messages:(d.messages??[]).map(normMsg)};setActive(fresh);setChats(prev=>{const next=prev.some(c=>c.user.username.toLowerCase()===clean.toLowerCase())?prev.map(c=>c.user.username.toLowerCase()===clean.toLowerCase()?fresh:c):[fresh,...prev];writeCache("messages",next);return next});setLoadingChat(false);}catch{setLoadingChat(false);if(!cached)setActive(null);setError("ما لكيت هذا الحساب أو تعذر فتح المحادثة.")}};
 useEffect(()=>{const target=params.get("username");if(!token)return;if(target)void open(target);else void load();},[token,params]);
 useEffect(()=>{if(!token)return;void pingPresence(token);const timer=window.setInterval(()=>{void pingPresence(token);void refreshPresence();},60000);return()=>window.clearInterval(timer);},[token]);
 useEffect(()=>{endRef.current?.scrollIntoView({block:"end"})},[active?.messages.length]);
 useEffect(()=>{
  const h=(ev:Event)=>{const e:any=(ev as CustomEvent).detail;if(e?.type!=="notification"||e.notificationType!=="message")return;const from=e.data?.actorId;if(active&&from&&from===active.user.id){apiRequest(`/messages/${encodeURIComponent(active.user.username)}`,token).then(d=>setActive({...d,messages:(d.messages??[]).map(normMsg)})).catch(()=>{});}else{void load();}};
  window.addEventListener("sdm:realtime",h);return()=>window.removeEventListener("sdm:realtime",h);
 },[token,active?.user.id]);
 const saveNote=async()=>{if(!token)return;const value=noteText.trim().slice(0,60);if(!value)return;setNoteSaving(true);try{await setMessageNote(token,value);setNoteOpen(false);setNoteText("");await refreshPresence();}catch{setError("تعذر نشر الملاحظة.");}finally{setNoteSaving(false)}};
 const removeNote=async()=>{if(!token)return;try{await deleteMessageNote(token);setNotes(n=>n.filter(x=>x.user.id!==user?.id));await refreshPresence();}catch{setError("تعذر حذف الملاحظة.")}};
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(!token||!active||!text.trim())return;const content=text.trim();const temp:Message={id:"tmp-"+Date.now(),content,createdAt:new Date().toISOString(),senderId:user!.id,receiverId:active.user.id||""};setActive(a=>a?a.messages.some(m=>m.id===temp.id)?a:{...a,messages:[...a.messages,temp]}:a);setText("");if(composerRef.current)composerRef.current.style.height="auto";try{const d=await apiRequest(`/messages/${encodeURIComponent(active.user.username)}`,token,{method:"POST",body:JSON.stringify({content})});if(d.message){setActive(a=>a?{...a,messages:a.messages.map(m=>m.id===temp.id?normMsg(d.message):m)}:a);setChats(a=>a.map(c=>c.user.username===active.user.username?{...c,messages:[normMsg(d.message)]}:c));void refreshPresence();}}catch{setActive(a=>a?{...a,messages:a.messages.filter(m=>m.id!==temp.id)}:a);setText(content);setError("تعذر إرسال الرسالة.")}};

 useEffect(()=>{document.body.classList.toggle("in-chat",Boolean(active));return()=>document.body.classList.remove("in-chat")},[Boolean(active)]);
 const isOnline=(id?:string)=>Boolean(id&&activeUsers.some(u=>u.id===id&&u.isActive));
 const verifiedBadge=(u:ChatUser)=>u.verifiedAt&&(u.isFounder||(u.supporterNumber&&u.supporterExpiresAt&&new Date(u.supporterExpiresAt).getTime()>Date.now()))?<span className="real-verified">✓</span>:null;
 const avatarOf=(u:{username:string;avatarUrl:string|null})=>u.avatarUrl||`https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}`;
 const myNote=notes.find(n=>n.user.id===user?.id);

 if(active){
  const rows=buildRows(active.messages,user?.id);
  return <main className="chat-screen">
   <header className="chat-top">
    <button type="button" className="chat-back" onClick={()=>{setActive(null);if(params.get("username"))navigate("/messages",{replace:true});void load();}} aria-label="رجوع"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    <button type="button" className="chat-peer" onClick={()=>navigate(`/u/${encodeURIComponent(active.user.username)}`)}>
     <span className="avatar-wrap"><img src={avatarOf(active.user)} alt=""/>{isOnline(active.user.id)&&<i className="online-dot"/>}</span>
     <span className="peer-text"><strong>{active.user.displayName||active.user.username}{verifiedBadge(active.user)}</strong><small>{isOnline(active.user.id)?"نشط الآن":"@"+active.user.username}</small></span>
    </button>
    <div className="chat-actions">
     <button type="button" aria-label="مكالمة صوتية" onClick={async()=>{if(!token||!active.user.id)return;try{const d=await startCall(token,active.user.id,false);location.href="/call?callId="+encodeURIComponent(d.callId)}catch{setError("تعذر بدء المكالمة.")}}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>
     <button type="button" aria-label="مكالمة فيديو" onClick={async()=>{if(!token||!active.user.id)return;try{const d=await startCall(token,active.user.id,true);location.href="/call?callId="+encodeURIComponent(d.callId)}catch{setError("تعذر بدء المكالمة.")}}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m23 7-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></button>
    </div>
   </header>
   <div className="chat-scroll">
    {loadingChat?<div className="chat-skeleton"><div className="sk s1"/><div className="sk s2"/><div className="sk s3"/><div className="sk s4"/></div>
    :rows.length===0?<div className="chat-empty"><img src={avatarOf(active.user)} alt=""/><strong>{active.user.displayName||active.user.username}</strong><span>@{active.user.username}</span><p>أرسل أول رسالة وخلّي الحوار يبدأ</p></div>
    :rows.map(r=>r.kind==="day"?<div key={r.key} className="day-sep">{r.label}</div>
     :<div key={r.key} className={"msg-row "+(r.mine?"mine":"theirs")+(r.first?" first":"")+(r.last?" last":"")}><div className="bubble">{r.m.content}</div>{r.last&&<span className="msg-time">{clock(r.m.createdAt)}</span>}</div>)}
    {error&&<p className="search-error">{error}</p>}
    <div ref={endRef}/>
   </div>
   <form className="chat-composer" onSubmit={send}>
    <textarea ref={composerRef} rows={1} value={text} maxLength={2000} placeholder="اكتب رسالة…" onChange={e=>{setText(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/>
    <button className="send-btn" disabled={!text.trim()} aria-label="إرسال"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>
   </form>
  </main>;
 }

 return <main className="feed-container"><section className="messages-panel dm-panel">
   <div className="dm-head"><h1>الرسائل</h1><p className="dm-sub">محادثات حقيقية مع حسابات المنصة</p></div>
   <div className="dm-notes-rail" aria-label="ملاحظات ومتصلون">
     <button type="button" className="dm-note-item is-me" onClick={()=>{setNoteText(myNote?.content||"");setNoteOpen(true)}}>
       <span className="dm-note-ring"><img src={user?.avatarUrl||`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username||"me")}&background=078968&color=fff`} alt=""/><span className="dm-note-plus" aria-hidden="true">+</span></span>
       <strong>{myNote?"ملاحظتي":"ملاحظة..."}</strong>
       {myNote&&<small>{myNote.content}</small>}
     </button>
     {activeUsers.map(u=>(
       <button key={u.id} type="button" className={"dm-note-item"+(u.note?" has-note":"")} onClick={()=>void open(u.username)}>
         <span className="dm-note-ring"><img src={u.avatarUrl||`https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=078968&color=fff`} alt=""/><span className="dm-online" aria-hidden="true"/></span>
         <strong>{u.displayName||u.username}</strong>
         {u.note&&<small>{u.note}</small>}
       </button>
     ))}
   </div>
   <form className="dm-search" onSubmit={e=>{e.preventDefault();void open(username)}}>
     <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="ابحث بـ @username لبدء محادثة" autoComplete="off"/>
     <button type="submit">محادثة</button>
   </form>
   {error&&<p className="search-error">{error}</p>}
   <div className="dm-list">
    {loadingList&&chats.length===0&&[0,1,2,3,4].map(i=><div key={i} className="dm-row sk-row"><div className="sk sk-av"/><div className="sk-lines"><div className="sk"/><div className="sk short"/></div></div>)}
    {!loadingList&&chats.length===0&&<div className="dm-empty"><strong>ماكو محادثات بعد</strong><p>اكتب @username بالبحث أو اضغط على أحد المتصلين بالأعلى عشان تبدأ.</p></div>}
    {chats.map(c=>{const last=c.messages[c.messages.length-1];return <button key={c.user.username} className="dm-row" onClick={()=>void open(c.user.username)}>
     <span className="avatar-wrap"><img src={avatarOf(c.user)} alt=""/>{isOnline(c.user.id)&&<i className="online-dot"/>}</span>
     <span className="dm-text"><span className="dm-top"><strong>{c.user.displayName||c.user.username}{verifiedBadge(c.user)}</strong>{last&&<time>{shortTime(last.createdAt)}</time>}</span><span className="dm-preview">{last?((last.senderId===user?.id?"أنت: ":"")+last.content):"ابدأ المحادثة"}</span></span>
    </button>})}
   </div>
   {noteOpen&&<div className="dm-note-modal" role="dialog" aria-modal="true" onClick={e=>{if(e.target===e.currentTarget)setNoteOpen(false)}}>
     <section className="dm-note-sheet">
       <h2>ملاحظتك</h2>
       <p>تظهر للناس اللي تتواصل وياهم لمدة 24 ساعة.</p>
       <textarea value={noteText} onChange={e=>setNoteText(e.target.value.slice(0,60))} maxLength={60} rows={3} placeholder="شنو ببالك؟"/>
       <div className="dm-note-meta"><span>{noteText.length}/60</span>{myNote&&<button type="button" className="dm-note-delete" onClick={()=>void removeNote()}>حذف</button>}</div>
       <div className="dm-note-actions">
         <button type="button" className="dm-note-cancel" onClick={()=>setNoteOpen(false)}>إلغاء</button>
         <button type="button" className="dm-note-share" onClick={()=>void saveNote()} disabled={noteSaving||!noteText.trim()}>{noteSaving?"جاري النشر...":"مشاركة الملاحظة"}</button>
       </div>
     </section>
   </div>}
 </section></main>;
}
