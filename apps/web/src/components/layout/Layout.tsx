import OptimizedImage from "../OptimizedImage";
import React,{useEffect} from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest,connectRealtime } from "../../lib/api";
import {
  HomeIcon,
  SearchIcon,
  PlusIcon,
  BellIcon,
  BookmarkIcon,
  SendIcon,
} from "../icons/Icons";

type LayoutProps = {
  children: React.ReactNode;
};

const avatar =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80";

type Suggestion = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { user,token } = useAuth();
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [pendingFollow, setPendingFollow] = React.useState<string | null>(null);
  const [unread, setUnread] = React.useState(0);
  useEffect(()=>{if(!token)return;let active=true;apiRequest("/auth/suggestions",token).then(d=>{if(active)setSuggestions(d.users??[])}).catch(()=>{});const loadUnread=()=>apiRequest("/notifications",token).then(d=>{if(active)setUnread((d.notifications??[]).filter((n:{read_at?:string|null})=>!n.read_at).length)}).catch(()=>{});void loadUnread();const onRead=()=>setUnread(0);const onRealtime=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type==="notification")setUnread(count=>count+1)};window.addEventListener("sdm:notifications-read",onRead);window.addEventListener("sdm:realtime",onRealtime);return()=>{active=false;window.removeEventListener("sdm:notifications-read",onRead);window.removeEventListener("sdm:realtime",onRealtime)}},[token]);
  useEffect(()=>{if(!token)return;let stop=()=>{};(async()=>{try{let reg: ServiceWorkerRegistration | undefined;if('serviceWorker' in navigator){reg=await navigator.serviceWorker.ready;const cfg=await apiRequest('/notifications/config',token);if('PushManager' in window&&Notification.permission==='granted'&&cfg.publicKey){const bytes=Uint8Array.from(atob(cfg.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});await apiRequest('/notifications/push-subscription',token,{method:'POST',body:JSON.stringify(sub.toJSON())})}}stop=connectRealtime(token,e=>{window.dispatchEvent(new CustomEvent('sdm:realtime', { detail: e }));if(e.type==='notification'&&'Notification'in window&&Notification.permission==='granted')reg?.showNotification(e.title,{body:e.body,data:e.data||{}}).catch(()=>{});if(e.type==='call'&&e.kind==='invite'&&e.callId)navigate('/call?incoming=1&callId='+encodeURIComponent(e.callId))})}catch{}})();return()=>stop()},[token,navigate]);

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">د</span>
            <span>دجلة سوشيال</span>
          </Link>

          <div className="top-actions">
            <Link to="/explore" className="icon-button mobile-hide">
              <SearchIcon />
            </Link>

            <Link to="/notifications" className="icon-button notification-button">
              <BellIcon />
              {unread > 0 && <span className="notification-dot" aria-label={`${unread} إشعار غير مقروء`} />}
            </Link>

            <button
              className="profile-mini"
              onClick={() => navigate("/profile")}
            >
              <OptimizedImage src={user?.avatarUrl || avatar} alt="حسابي" />
            </button>
          </div>
        </div>
      </header>

      <div className="page-layout">
        <aside className="desktop-sidebar">
          <nav>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "side-link active" : "side-link"
              }
            >
              <HomeIcon />
              <span>الرئيسية</span>
            </NavLink>

            <NavLink
              to="/explore"
              className={({ isActive }) =>
                isActive ? "side-link active" : "side-link"
              }
            >
              <SearchIcon />
              <span>استكشاف</span>
            </NavLink>

            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                isActive ? "side-link active" : "side-link"
              }
            >
              <BellIcon />
              <span>الإشعارات</span>
            </NavLink>

            <NavLink
              to="/saved"
              className={({ isActive }) =>
                isActive ? "side-link active" : "side-link"
              }
            >
              <BookmarkIcon />
              <span>المحفوظات</span>
            </NavLink>

            <NavLink
              to="/profile"
              className={({ isActive }) =>
                isActive ? "side-link active" : "side-link"
              }
            >
              <span className="side-avatar">
                <OptimizedImage src={user?.avatarUrl || avatar} alt="" />
              </span>
              <span>حسابي</span>
            </NavLink>
          </nav>

          <Link to="/create" className="create-button">
            <PlusIcon size={20} />
            <span>إنشاء منشور</span>
          </Link>

          <div className="sidebar-footer">
            <span>دجلة سوشيال</span>
          </div>
        </aside>

        {children}

        <aside className="right-panel">
          <div className="profile-card">
            <div className="profile-row">
              <OptimizedImage src={user?.avatarUrl || avatar} alt={user?.displayName || user?.username || "حسابي"} />

              <div>
                <strong>{user?.displayName || user?.username || "مستخدم"}</strong>
                <span>@{user?.username || "مستخدم"}</span>
              </div>

              <Link to="/profile">تعديل</Link>
            </div>
          </div>

          <div className="suggestions">
            <div className="suggestions-title">
              <strong>حسابات مقترحة</strong>
              <Link to="/explore">عرض الكل</Link>
            </div>

            {suggestions.length === 0 ? (
              <p className="suggestions-empty">ماكو حسابات جديدة. أي حساب حقيقي ما تتابعه راح يظهر هنا.</p>
            ) : suggestions.map((person) => (
              <div className="suggestion" key={person.id}>
                <OptimizedImage src={person.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.displayName || person.username)}&background=078968&color=fff`} alt="" />
                <div>
                  <Link to={`/u/${encodeURIComponent(person.username)}`}><strong>{person.displayName || person.username}</strong></Link>
                  <span>@{person.username}</span>
                </div>
                <button
                  type="button"
                  disabled={pendingFollow === person.id}
                  onClick={() => {
                    if (!token) return;
                    setPendingFollow(person.id);
                    void apiRequest(`/auth/users/${encodeURIComponent(person.username)}/follow`, token, { method: "POST" })
                      .then(() => setSuggestions((list) => list.filter((item) => item.id !== person.id)))
                      .catch(() => {})
                      .finally(() => setPendingFollow(null));
                  }}
                >
                  متابعة
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <nav className="mobile-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <HomeIcon />
          <span>منشورات</span>
        </NavLink>
        <NavLink to="/reels" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <span className="nav-glyph">▶</span>
          <span>ريلز</span>
        </NavLink>
        <NavLink to="/messages" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <SendIcon />
          <span>الرسائل</span>
        </NavLink>
        <NavLink to="/explore" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <SearchIcon />
          <span>البحث</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <span className="nav-avatar"><OptimizedImage src={user?.avatarUrl || avatar} alt="" /></span>
          <span>حسابي</span>
        </NavLink>
      </nav>    </div>
  );
}
