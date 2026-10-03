import { useEffect,useState,useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest,connectRealtime,sendSignal,startCall,getCall,getCallConfig,acceptCall,rejectCall,endCall,getActiveUsers,getMessageNotes,setMessageNote,deleteMessageNote,pingPresence } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Message={id:string;content:string;createdAt:string;senderId:string;receiverId:string};
type ChatUser={id?:string;username:string;displayName:string|null;avatarUrl:string|null;verifiedAt?:string|null;supporterNumber?:string|null;supporterExpiresAt?:string|null;isFounder?:boolean};
type Chat={user:ChatUser;messages:Message[]};
type ActiveUser={id:string;username:string;displayName:string|null;avatarUrl:string|null;verifiedAt?:string|null;supporterNumber?:string|null;supporterExpiresAt?:string|null;isFounder?:boolean;isActive:boolean;note?:string|null;noteCreatedAt?:string|null;noteExpiresAt?:string|null};
type Note={user:{id:string;username:string;displayName:string|null;avatarUrl:string|null};content:string;createdAt:string;expiresAt:string;isActive:boolean};

export default function MessagesPage(){
 const {token,user}=useAuth(); const navigate=useNavigate(); const [params]=useSearchParams();
 const [chats,setChats]=useState<Chat[]>([]); const [active,setActive]=useState<Chat|null>(null); const [text,setText]=useState("");
 const [username,setUsername]=useState(params.get("username")||""); const [error,setError]=useState("");
 const [activeUsers,setActiveUsers]=useState<ActiveUser[]>([]); const [notes,setNotes]=useState<Note[]>([]);
 const [noteOpen,setNoteOpen]=useState(false); const [noteText,setNoteText]=useState(""); const [noteSaving,setNoteSaving]=useState(false);

 const load=async()=>{if(!token)return;try{const [ch,n,a]=await Promise.all([apiRequest("/messages",token),getMessageNotes(token),getActiveUsers(token)]);setChats(ch.chats??[]);setNotes(n.notes??[]);setActiveUsers(a.users??[]);}catch{setError("تعذر تحميل الرسائل.");}};
 const refreshPresence=async()=>{if(!token)return;try{const [n,a]=await Promise.all([getMessageNotes(token),getActiveUsers(token)]);setNotes(n.notes??[]);setActiveUsers(a.users??[]);}catch{}};
 const open=async(u:string)=>{if(!token||!u.trim())return;try{const clean=u.replace(/^@/,"").trim();const d=await apiRequest(`/messages/${encodeURIComponent(clean)}`,token);setActive(d);setUsername(clean);setError("");}catch{setError("ما لكيت هذا الحساب أو تعذر فتح المحادثة.")}};
 useEffect(()=>{const target=params.get("username");if(!token)return;if(target)void open(target);else void load();},[token,params]);
 useEffect(()=>{if(!token)return;void pingPresence(token);const timer=window.setInterval(()=>{void pingPresence(token);void refreshPresence();},60000);return()=>window.clearInterval(timer);},[token]);
 const saveNote=async()=>{if(!token)return;const value=noteText.trim().slice(0,60);if(!value)return;setNoteSaving(true);try{await setMessageNote(token,value);setNoteOpen(false);setNoteText("");await refreshPresence();}catch{setError("تعذر نشر الملاحظة.");}finally{setNoteSaving(false)}};
 const removeNote=async()=>{if(!token)return;try{await deleteMessageNote(token);setNotes(n=>n.filter(x=>x.user.id!==user?.id));await refreshPresence();}catch{setError("تعذر حذف الملاحظة.")}};
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(!token||!active||!text.trim())return;try{const d=await apiRequest(`/messages/${encodeURIComponent(active.user.username)}`,token,{method:"POST",body:JSON.stringify({content:text.trim()})});setText("");if(d.message){setActive(a=>a?a.messages.some(m=>m.id===d.message.id)?a:{...a,messages:[...a.messages,d.message]}:a);setChats(a=>a.map(c=>c.user.username===active.user.username?{...c,messages:[d.message]}:c));void refreshPresence();}}catch{setError("تعذر إرسال الرسالة.")}};

 const myNote=notes.find(n=>n.user.id===user?.id);

 if(active)return <main className="feed-container"><section className="messages-panel"><button className="back-messages" onClick={()=>setActive(null)}>← الرسائل</button><header className="chat-header"><button type="button" className="chat-user-link" onClick={()=>navigate(`/u/${encodeURIComponent(active.user.username)}`)} aria-label="فتح الحساب"><img src={active.user.avatarUrl||`https://ui-avatars.com/api/?name=${encodeURIComponent(active.user.username)}`} alt="" /></button><div className="chat-call-buttons"><button onClick={async()=>{if(!token||!active.user.id)return;try{const d=await startCall(token,active.user.id,true);location.href="/call?callId="+encodeURIComponent(d.callId)}catch{setError("تعذر بدء المكالمة.")}}}>📹</button><button onClick={async()=>{if(!token||!active.user.id)return;try{const d=await startCall(token,active.user.id,false);location.href="/call?callId="+encodeURIComponent(d.callId)}catch{setError("تعذر بدء المكالمة.")}}}>📞</button></div><button type="button" className="chat-user-info" onClick={()=>navigate(`/u/${encodeURIComponent(active.user.username)}`)}><strong>{active.user.displayName||active.user.username}{active.user.verifiedAt&&(active.user.isFounder||(active.user.supporterNumber&&active.user.supporterExpiresAt&&new Date(active.user.supporterExpiresAt).getTime()>Date.now()))&&<span className="real-verified">✓</span>}</strong><span>@{active.user.username}</span></button></header><div className="chat-list">{active.messages.map(m=><div key={m.id} className={m.senderId===user?.id?"message":"message other"}>{m.content}<small>{new Date(m.createdAt).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})}</small></div>)}</div><form className="message-form" onSubmit={send}><input value={text} onChange={e=>setText(e.target.value)} placeholder="اكتب رسالة..." maxLength={2000}/><button>إرسال</button></form>{error&&<p className="search-error">{error}</p>}</section></main>;

 return <main className="feed-container"><section className="messages-panel">
   <div className="messages-title"><h1>الرسائل</h1><span>دردشة مباشرة بين المستخدمين</span></div>
   <div style={{margin:"4px 0 18px",padding:"4px 0",overflowX:"auto",display:"flex",gap:12,direction:"rtl"}}>
     <button type="button" onClick={()=>{setNoteText(myNote?.content||"");setNoteOpen(true)}} style={{flex:"0 0 76px",border:0,background:"transparent",padding:0,cursor:"pointer"}}>
       <div style={{width:62,height:62,borderRadius:"50%",margin:"auto",padding:2,border:"2px solid #1877f2",position:"relative",boxSizing:"border-box"}}><img src={user?.avatarUrl||`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username||"me")}`} alt="" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}}/><span style={{position:"absolute",right:-2,bottom:-1,width:19,height:19,borderRadius:"50%",background:"#fff",display:"grid",placeItems:"center",fontSize:14}}>＋</span></div>
       <strong style={{display:"block",fontSize:11,marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{myNote?"ملاحظتي":"ملاحظة..."}</strong>
       {myNote&&<small style={{display:"block",fontSize:10,color:"#777",maxWidth:74,overflow:"hidden",textOverflow:"ellipsis"}}>{myNote.content}</small>}
     </button>
     {activeUsers.map(u=><button key={u.id} type="button" onClick={()=>void open(u.username)} style={{flex:"0 0 82px",border:0,background:"transparent",padding:0,cursor:"pointer"}}>
       <div style={{width:62,height:62,borderRadius:"50%",margin:"auto",padding:2,border:u.note?"2px solid #f7b731":"2px solid #ddd",position:"relative",boxSizing:"border-box"}}><img src={u.avatarUrl||`https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}`} alt="" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}}/><span style={{position:"absolute",left:0,bottom:0,width:15,height:15,borderRadius:"50%",background:"#27ae60",border:"2px solid #fff"}}/></div>
       <strong style={{display:"block",fontSize:11,marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.displayName||u.username}</strong>
       {u.note&&<small style={{display:"block",fontSize:10,color:"#777",maxWidth:82,overflow:"hidden",textOverflow:"ellipsis"}}>{u.note}</small>}
     </button>)}
   </div>
   <form className="message-search" onSubmit={e=>{e.preventDefault();void open(username)}}><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="اكتب @username"/><button>محادثة</button></form>
   {error&&<p className="search-error">{error}</p>}
   <div className="chat-list">{chats.map(c=><button className="chat-row" key={c.user.username} onClick={()=>void open(c.user.username)}><img src={c.user.avatarUrl||`https://ui-avatars.com/api/?name=${encodeURIComponent(c.user.username)}`} alt="" /><div><strong>{c.user.displayName||c.user.username}{c.user.verifiedAt&&(c.user.isFounder||(c.user.supporterNumber&&c.user.supporterExpiresAt&&new Date(c.user.supporterExpiresAt).getTime()>Date.now()))&&<span className="real-verified">✓</span>}</strong><span>@{c.user.username}</span><small>{c.messages[c.messages.length-1]?.content||"ابدأ المحادثة"}</small></div></button>)}</div>
   {noteOpen&&<div role="dialog" aria-modal="true" onClick={e=>{if(e.target===e.currentTarget)setNoteOpen(false)}} style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,.55)",display:"grid",placeItems:"center",padding:20}}>
     <section style={{width:"min(430px,100%)",background:"#fff",borderRadius:22,padding:20,direction:"rtl",boxSizing:"border-box"}}>
       <h2 style={{marginTop:0}}>ملاحظتك</h2><p style={{color:"#777",fontSize:13}}>تظهر للناس الذين تتواصل معهم لمدة 24 ساعة.</p>
       <textarea value={noteText} onChange={e=>setNoteText(e.target.value.slice(0,60))} maxLength={60} rows={3} placeholder="شنو ببالك؟" style={{width:"100%",boxSizing:"border-box",resize:"none",border:"1px solid #ddd",borderRadius:14,padding:12,fontFamily:"inherit"}}/>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,color:"#777",fontSize:12}}><span>{noteText.length}/60</span>{myNote&&<button type="button" onClick={()=>void removeNote()} style={{border:0,background:"transparent",color:"#c00"}}>حذف</button>}</div>
       <div style={{display:"flex",gap:8,marginTop:14}}><button type="button" onClick={()=>setNoteOpen(false)} style={{flex:1,padding:11,border:"1px solid #ddd",borderRadius:12,background:"#fff"}}>إلغاء</button><button type="button" onClick={()=>void saveNote()} disabled={noteSaving||!noteText.trim()} style={{flex:1,padding:11,border:0,borderRadius:12,background:"#111",color:"#fff"}}>{noteSaving?"جاري النشر...":"مشاركة الملاحظة"}</button></div>
     </section>
   </div>}
 </section></main>;
}

export function CallPage(){
 const{token,user}=useAuth();const[p]=useSearchParams();const callId=p.get("callId")||"";const incoming=p.get("incoming")==="1";
 const remote=useRef<HTMLVideoElement>(null),local=useRef<HTMLVideoElement>(null),pc=useRef<RTCPeerConnection|null>(null),pendingIce=useRef<any[]>([]);
 const[call,setCall]=useState<any>(null),[status,setStatus]=useState(incoming?"مكالمة واردة":"جاري الاتصال..."),[error,setError]=useState(""),[speaker,setSpeaker]=useState(false),[accepted,setAccepted]=useState(!incoming);
 const streamRef=useRef<MediaStream|null>(null); const acceptedRef=useRef(!incoming); let otherId="";
 useEffect(()=>{if(!token||!callId)return;let stop=()=>{};let alive=true;
   const setupMedia=async(video:boolean)=>{if(streamRef.current)return;const s=await navigator.mediaDevices.getUserMedia({audio:true,video});streamRef.current=s;if(local.current)local.current.srcObject=s;const iceConfig=await getCallConfig(token);const peer=new RTCPeerConnection({iceServers:iceConfig.iceServers||[{urls:"stun:stun.l.google.com:19302"}]});pc.current=peer;s.getTracks().forEach(t=>peer.addTrack(t,s));peer.ontrack=e=>{if(remote.current){remote.current.srcObject=e.streams[0];void remote.current.play().catch(()=>{})}};peer.onicecandidate=e=>{if(e.candidate&&call)void sendSignal(token,otherId,"ice",{callId,candidate:e.candidate.toJSON()})};return peer};
   (async()=>{try{
     const d=await getCall(token,callId);if(!alive)return;setCall(d.call);
     const c=d.call;const isCaller=c.caller_id===user?.id;
     otherId=isCaller?c.callee_id:c.caller_id;
     const video=c.kind==="video";
     if(c.status==="missed"||c.status==="rejected"||c.status==="ended"){setStatus(c.status==="missed"?"مكالمة فائتة":c.status==="rejected"?"تم رفض المكالمة":"انتهت المكالمة");return}
     stop=connectRealtime(token,async e=>{
       if(!alive||e.type!=="call"||e.callId!==callId)return;
       try{
         if(e.kind==="accept"&&!incoming){await setupMedia(video);const peer=pc.current!;const offer=await peer.createOffer();await peer.setLocalDescription(offer);await sendSignal(token,otherId,"offer",{callId,sdp:offer});setStatus("جاري الاتصال...");}
         if(e.kind==="reject"){setStatus("تم رفض المكالمة");setTimeout(()=>location.href="/messages",1200)}
         if(e.kind==="hangup"){setStatus("انتهت المكالمة");setTimeout(()=>location.href="/messages",700)}
         if(e.kind==="offer"&&incoming&&acceptedRef.current){const peer=pc.current||await setupMedia(video);if(!peer)throw new Error("PEER_NOT_READY");await peer.setRemoteDescription(e.payload.sdp);for(const ice of pendingIce.current)await peer.addIceCandidate(ice);pendingIce.current=[];const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await sendSignal(token,otherId,"answer",{callId,sdp:answer});setStatus("متصل")}
         if(e.kind==="answer"&&!incoming){const peer=pc.current;if(peer){await peer.setRemoteDescription(e.payload.sdp);for(const ice of pendingIce.current)await peer.addIceCandidate(ice);pendingIce.current=[];setStatus("متصل")}}
         if(e.kind==="ice"&&e.payload?.callId===callId){const candidate=new RTCIceCandidate(e.payload.candidate);if(pc.current?.remoteDescription)await pc.current.addIceCandidate(candidate);else pendingIce.current.push(candidate)}
       }catch{setError("تعذر إنشاء الاتصال الصوتي.");}
     });
     if(!incoming&&c.status==="ringing"){await setupMedia(video);}
   }catch{if(alive)setError("تعذر تحميل المكالمة.")}})();
   return()=>{alive=false;stop();streamRef.current?.getTracks().forEach(t=>t.stop());pc.current?.close()};
 },[token,callId,incoming,user?.id]);
 const doAccept=async()=>{if(!token||!callId||!call)return;try{const video=call.kind==="video";if(!streamRef.current){const s=await navigator.mediaDevices.getUserMedia({audio:true,video});streamRef.current=s;if(local.current)local.current.srcObject=s;const iceConfig=await getCallConfig(token);const peer=new RTCPeerConnection({iceServers:iceConfig.iceServers||[{urls:"stun:stun.l.google.com:19302"}]});pc.current=peer;s.getTracks().forEach(t=>peer.addTrack(t,s));peer.ontrack=e=>{if(remote.current){remote.current.srcObject=e.streams[0];void remote.current.play().catch(()=>{})}};peer.onicecandidate=e=>{if(e.candidate)void sendSignal(token,call.caller_id,"ice",{callId,candidate:e.candidate.toJSON()})}}await acceptCall(token,callId);acceptedRef.current=true;setAccepted(true);setStatus("جاري الاتصال...");}catch{setError("تعذر تشغيل المايك.");}};
 const doReject=async()=>{if(token&&callId)try{await rejectCall(token,callId)}catch{}location.href="/messages"};
 const hang=async()=>{if(token&&callId)try{await endCall(token,callId)}catch{}location.href="/messages"};
 const toggleSpeaker=async()=>{const el=remote.current as any;if(el?.setSinkId){try{await el.setSinkId(speaker?"default":"default");setSpeaker(v=>!v)}catch{setSpeaker(v=>!v)}}else setSpeaker(v=>!v)};
 if(!callId)return <main className="call-page"><header><button onClick={()=>location.href="/messages"}>✕</button><strong>مكالمة</strong></header><p className="call-error">رابط المكالمة غير صالح.</p></main>;
 return <main className={"call-page "+(call?.kind==="audio"?"audio-call":"")}><header><button onClick={hang}>✕</button><div><strong>{call?.display_name||call?.username||"مستخدم"}</strong><span>{status}</span></div></header>
   {incoming&&!accepted&&call?.status==="ringing"?<div className="incoming-call-card"><div className="incoming-call-icon">📞</div><h2>{call.display_name||call.username}</h2><p>{call.kind==="video"?"مكالمة فيديو واردة":"مكالمة صوتية واردة"}</p><div><button className="accept-call" onClick={()=>void doAccept()}>رد</button><button className="reject-call" onClick={()=>void doReject()}>رفض</button></div></div>:<><div className="call-videos"><video ref={remote} autoPlay playsInline className="call-remote"/><video ref={local} autoPlay muted playsInline className="call-local"/>{call?.kind==="audio"&&<div className="audio-call-avatar">📞</div>}</div><div className="call-actions"><button onClick={()=>void toggleSpeaker()} title="السبيكر">{speaker?"🔊":"🔈"}</button><button onClick={hang} className="hangup">📞</button></div></>}
   {error&&<p className="call-error">{error}</p>}</main>
}
export function NotificationsLivePage(){const{token}=useAuth();const navigate=useNavigate();const[list,setList]=useState<any[]>([]);const load=async()=>{if(token){const d=await apiRequest('/notifications',token);setList(d.notifications||[])}};useEffect(()=>{void load()},[token]);const enable=async()=>{if(!token||!('Notification'in window)||!('serviceWorker'in navigator))return;const p=await Notification.requestPermission();if(p!=='granted')return;const reg=await navigator.serviceWorker.ready;const cfg=await apiRequest('/notifications/config',token);const bytes=Uint8Array.from(atob(cfg.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});await apiRequest('/notifications/push-subscription',token,{method:'POST',body:JSON.stringify(sub.toJSON())});};return <main className="feed-container"><section className="stories-card"><div style={{padding:20}}><h1 style={{marginTop:0}}>الإشعارات</h1><p style={{color:'#777'}}>رسائل، إعجابات ومنشورات جديدة.</p><button onClick={()=>void enable()} style={{padding:'11px 16px',borderRadius:12,background:'#111715',color:'#fff'}}>🔔 تفعيل إشعارات الجهاز</button></div><div className="chat-list">{list.map(n=>{let data:any={};try{data=typeof n.data==="string"?JSON.parse(n.data):(n.data||{})}catch{};const url=typeof data.url==="string"?data.url:"";return <button type="button" key={n.id} className="chat-row" onClick={()=>{if(url)navigate(url)}} disabled={!url}><div><strong>{n.title}</strong><small>{n.body}</small></div></button>})}</div></section></main>}
