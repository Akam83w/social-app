import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function CreateStoryPage(){
  const {token}=useAuth(); const nav=useNavigate(); const ref=useRef<HTMLInputElement>(null);
  const [url,setUrl]=useState(""); const [text,setText]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");

  function choose(e:React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0]; e.target.value=""; if(!f)return;
    if(!f.type.startsWith("image/")){setError("حاليًا القصص تدعم الصور فقط. الفيديو راح يتوفر لاحقًا.");return}
    if(f.size>2*1024*1024){setError("الستوري حالياً لازم تكون أقل من 2 ميگابايت");return}
    const r=new FileReader(); r.onload=()=>{setUrl(String(r.result));setError("")}; r.readAsDataURL(f)
  }

  async function submit(e:React.FormEvent){e.preventDefault();if(!token||!url||busy)return;setBusy(true);
    try{await apiRequest("/stories",token,{method:"POST",body:JSON.stringify({mediaUrl:url,mediaType:"image",content:text.trim()||undefined})});nav("/")}
    catch(err){setError(err instanceof Error?err.message:"تعذر نشر القصة")}finally{setBusy(false)}
  }

  return <main className="feed-container"><section className="stories-card"><form className="story-create" onSubmit={submit}>
    <h1>إنشاء قصة</h1><p>الصورة تبقى 24 ساعة مثل القصص. دعم الفيديو متوقف مؤقتًا بالبداية.</p>
    <input ref={ref} hidden type="file" accept="image/*" onChange={choose}/><button type="button" onClick={()=>ref.current?.click()}>إضافة صورة</button>
    {url&&<img src={url} className="story-preview" alt="معاينة القصة"/>}
    <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="أضف نصاً إلى قصتك..." maxLength={500}/>
    {error&&<p className="search-error">{error}</p>}<button className="story-publish" disabled={!url||busy}>{busy?"جاري النشر...":"نشر القصة"}</button>
  </form></section></main>
}
