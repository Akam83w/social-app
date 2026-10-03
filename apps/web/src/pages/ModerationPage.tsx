import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Report = { id:string; target_id:string; target_type:string; reason:string; status:string; decision?:string|null; moderator_note?:string|null; created_at:string; reporter_username?:string; target_username?:string; moderation_status?:string; moderation_strikes?:string; };
type Appeal = { id:string; user_id:string; username:string; reason:string; status:string; moderation_status?:string; moderation_strikes?:string; suspended_until?:string|null; created_at:string; };

export default function ModerationPage(){
  const {token}=useAuth();
  const [reports,setReports]=useState<Report[]>([]);
  const [appeals,setAppeals]=useState<Appeal[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const load=async()=>{
    if(!token)return;
    setLoading(true);setError("");
    try{
      const [rr,aa]=await Promise.all([fetch(API_URL+"/moderation/reports?status=pending",{headers:{Authorization:"Bearer "+token}}),fetch(API_URL+"/moderation/appeals",{headers:{Authorization:"Bearer "+token}})]);
      const rd=await rr.json(); const ad=await aa.json();
      if(rr.status===403||aa.status===403)throw new Error("MODERATOR_REQUIRED");
      if(!rr.ok)throw new Error(rd.error||"LOAD_FAILED");
      if(!aa.ok)throw new Error(ad.error||"LOAD_FAILED");
      setReports(rd.reports||[]);setAppeals(ad.appeals||[]);
    }catch(e:any){setError(e?.message==="MODERATOR_REQUIRED"?"هذا القسم للمشرفين فقط.":"تعذر تحميل لوحة الإشراف.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[token]);
  const decideReport=async(id:string,decision:string)=>{
    if(!token)return;setBusy(id);
    try{const r=await fetch(API_URL+"/moderation/reports/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({decision})});if(!r.ok)throw new Error();setReports(v=>v.filter(x=>x.id!==id));}
    catch{setError("تعذر تنفيذ القرار.");}finally{setBusy("");}
  };
  const decideAppeal=async(id:string,decision:string)=>{
    if(!token)return;setBusy(id);
    try{const r=await fetch(API_URL+"/moderation/appeals/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({decision})});if(!r.ok)throw new Error();setAppeals(v=>v.filter(x=>x.id!==id));}
    catch{setError("تعذر تنفيذ قرار الاستئناف.");}finally{setBusy("");}
  };
  return <main className="feed-container" dir="rtl"><section className="stories-card" style={{padding:20}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><div><h1 style={{margin:"0 0 6px"}}>لوحة الإشراف</h1><p style={{margin:0}}>بلاغات واستئنافات مرتبطة بقاعدة البيانات.</p></div><button type="button" onClick={()=>void load()} disabled={loading}>تحديث</button></header>
    {error&&<p className="search-error">{error}</p>}
    {loading?<p>جاري التحميل...</p>:<>
      <h2 style={{marginTop:24}}>البلاغات المعلقة ({reports.length})</h2>
      {reports.length===0?<p>لا توجد بلاغات معلقة.</p>:<div style={{display:"grid",gap:12}}>{reports.map(r=><article key={r.id} className="post-card" style={{padding:14}}><strong>{r.target_type==="user"?"حساب":"منشور"} {r.target_username?("@"+r.target_username):""}</strong><p>{r.reason}</p><small>المبلّغ: @{r.reporter_username||"مستخدم"} · {new Date(r.created_at).toLocaleString("ar-IQ")}</small><div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}><button disabled={busy===r.id} onClick={()=>void decideReport(r.id,"dismiss")}>إغلاق البلاغ</button><button disabled={busy===r.id} onClick={()=>void decideReport(r.id,"warn")}>تحذير</button><button disabled={busy===r.id} onClick={()=>void decideReport(r.id,"suspend_24h")}>إيقاف 24 ساعة</button><button disabled={busy===r.id} onClick={()=>void decideReport(r.id,"suspend_7d")}>إيقاف 7 أيام</button><button disabled={busy===r.id} onClick={()=>void decideReport(r.id,"suspend_permanent")}>إيقاف دائم</button>{r.target_type==="post"&&<button disabled={busy===r.id} onClick={()=>void decideReport(r.id,"remove_content")}>حذف المحتوى</button>}</div></article>)}</div>}
      <h2 style={{marginTop:28}}>الاستئنافات ({appeals.length})</h2>
      {appeals.length===0?<p>لا توجد استئنافات معلقة.</p>:<div style={{display:"grid",gap:12}}>{appeals.map(a=><article key={a.id} className="post-card" style={{padding:14}}><strong>@{a.username}</strong><p>{a.reason}</p><small>الحالة: {a.moderation_status||"غير معروفة"} · المخالفات: {a.moderation_strikes||"0"}</small><div style={{display:"flex",gap:8,marginTop:12}}><button disabled={busy===a.id} onClick={()=>void decideAppeal(a.id,"accept")}>قبول الاستئناف</button><button disabled={busy===a.id} onClick={()=>void decideAppeal(a.id,"reject")}>رفض الاستئناف</button></div></article>)}</div>}
    </>}</section></main>;
}