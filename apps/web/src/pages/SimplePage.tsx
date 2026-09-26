import { useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

type SimplePageProps = { title: string; description: string; icon: ReactNode; };

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function SimplePage({ title, description, icon }: SimplePageProps) {
  const { token, user } = useAuth();
  const isSearch = title === "استكشاف";
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const value = username.trim().replace(/^@/, "");
    if (!value || !token) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_URL}/auth/search/users/${encodeURIComponent(value)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setResult({ ...data.user, isFollowing: data.isFollowing, followerCount: data.followerCount });
    } catch { setError("ما لكيت حساب بهذا اليوزر."); }
    finally { setLoading(false); }
  }

  async function toggleFollow() {
    if (!result || !token || result.id === user?.id || following) return;
    setFollowing(true);
    try {
      const method = result.isFollowing ? "DELETE" : "POST";
      const res = await fetch(`${API_URL}/auth/users/${encodeURIComponent(result.username)}/follow`, { method, headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setResult((x: any) => ({ ...x, isFollowing: data.following, followerCount: Math.max(0, x.followerCount + (data.following ? 1 : -1)) }));
    } catch { setError("تعذر تحديث المتابعة."); }
    finally { setFollowing(false); }
  }

  return (
    <main className="feed-container">
      <section className="stories-card" style={{ minHeight: 420 }}>
        {isSearch ? (
          <div className="account-search">
            <h1>البحث عن حساب</h1>
            <p>البحث يكون باليوزر فقط.</p>
            <form onSubmit={search} className="account-search-form">
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" autoComplete="off" />
              <button type="submit" disabled={loading || !username.trim()}>{loading ? "جاري البحث..." : "بحث"}</button>
            </form>
            {error && <p className="search-error">{error}</p>}
            {result && (
              <div className="search-result">
                <img src={result.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(result.username)}&background=random`} alt={result.username} />
                <div><strong>{result.displayName || result.username}</strong><span>@{result.username} · {result.followerCount} متابع</span></div>
                <div className="search-actions">
                  <Link to={`/u/${encodeURIComponent(result.username)}`}>عرض الحساب</Link>
                  {result.id !== user?.id && <button type="button" onClick={() => void toggleFollow()} disabled={following}>{result.isFollowing ? "إلغاء المتابعة" : "متابعة"}</button>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 30 }}>
            <div style={{ marginBottom: 20 }}>{icon}</div>
            <h1>{title}</h1><p style={{ color: "#777", marginTop: 10 }}>{description}</p>
          </div>
        )}
      </section>
    </main>
  );
}
