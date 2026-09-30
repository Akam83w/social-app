import OptimizedImage from "../components/OptimizedImage";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, API_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "../components/VideoPlayer";

export default function CreateStoryPage(){
  const {token}=useAuth(); const nav=useNavigate(); const ref=useRef<HTMLInputElement>(null);
  const [url,setUrl]=useState(""); const [video,setVideo]=useState<File|null>(null); const [text,setText]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");

  function choose(e:React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0]; e.target.value=""; if(!f)return;
    if(f.type.startsWith("video/")){
      if(f.size>100*1024*1024){setError("الفيديو لازم يكون أقل من 100 ميگابايت");return}
      setUrl(URL.createObjectURL(f)); setVideo(f); setError(""); return;
    }
    if(!f.type.startsWith("image/")){setError("اختار صورة أو فيديو فقط.");return}
    if(f.size>2*1024*1024){setError("الصورة لازم تكون أقل من 2 ميگابايت");return}
    setVideo(null); if(url.startsWith("blob:"))URL.revokeObjectURL(url);
    const r=new FileReader(); r.onload=()=>{setUrl(String(r.result));setError("")}; r.onerror=()=>setError("تعذر قراءة الصورة"); r.readAsDataURL(f)
  }

  async function submit(e:React.FormEvent){
    e.preventDefault(); if(!token||!url||busy)return; setBusy(true); setError("");
    try{
      if(video){
        const form=new FormData(); form.append("content",text.trim()); form.append("file",video,video.name);
        const res=await fetch(API_URL+"/stories/video",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
        const responseText=await res.text();
        let data:{error?:string}={};
        try{data=responseText?JSON.parse(responseText):{}}catch{throw new Error("VIDEO_API_INVALID_RESPONSE")}
        if(!res.ok)throw new Error(data.error||"VIDEO_PROCESSING_FAILED");
      }else{
        await apiRequest("/stories",token,{method:"POST",body:JSON.stringify({mediaUrl:url,mediaType:"image",content:text.trim()||undefined})});
      }
      nav("/");
    }catch(err){setError(err instanceof Error&&err.message==="VIDEO_API_INVALID_RESPONSE"?"سيرفر الفيديو رجّع استجابة غير صحيحة":err instanceof Error?err.message:"تعذر نشر القصة")}finally{setBusy(false)}
  }

  return <main className="feed-container"><section className="stories-card"><form className="story-create" onSubmit={submit}>
    <h1>إنشاء قصة</h1><p>الصورة أو الفيديو يبقى 24 ساعة. الفيديو ينضغط تلقائيًا.</p>
    <input ref={ref} hidden type="file" accept="image/*,video/*" onChange={choose}/>
    <button type="button" onClick={()=>ref.current?.click()}>إضافة صورة أو فيديو</button>
    {url&&video?<VideoPlayer src={url} className="story-preview" controls/>:url&&<OptimizedImage src={url} className="story-preview" alt="معاينة القصة"/>}
    <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="أضف نصاً إلى قصتك..." maxLength={500}/>
    {error&&<p className="search-error">{error}</p>}
    <button className="story-publish" disabled={!url||busy}>{busy?(video?"جاري ضغط الفيديو ونشره...":"جاري النشر..."):"نشر القصة"}</button>
  </form></section></main>
}
