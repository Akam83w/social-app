import { Link } from "react-router-dom";

export default function ReelsPage() {
  return (
    <main className="feed-container">
      <section className="stories-card" style={{textAlign:"center",padding:"48px 20px"}}>
        <h1 style={{marginBottom:10}}>الفيديوهات</h1>
        <p style={{color:"#777",lineHeight:1.8}}>الفيديوهات متوقفة مؤقتًا في بداية SDM حتى نحافظ على سرعة واستقرار المنصة.</p>
        <p style={{color:"#999",fontSize:13}}>راح نرجعها لاحقًا بعد توفر الدعم والجمهور الكافي لتطوير نظام فيديو سريع.</p>
        <Link to="/" style={{display:"inline-block",marginTop:18}}>العودة للمنشورات</Link>
      </section>
    </main>
  );
}
