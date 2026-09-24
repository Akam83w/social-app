import { useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import "./index.css";

type IconProps = {
  size?: number;
  strokeWidth?: number;
};

function HomeIcon({ size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10.8 12 3l9 7.8v8.2a2 2 0 0 1-2 2h-4.5v-6h-5v6H5a2 2 0 0 1-2-2v-8.2Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle
        cx="10.8"
        cy="10.8"
        r="6.8"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        d="m16 16 5 5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon({ size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon({
  size = 24,
  filled = false,
  strokeWidth = 1.8,
}: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M20.8 8.7c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10C3.2 5.4 5.5 3 8.5 3c1.7 0 2.9.8 3.5 2 0.6-1.2 1.8-2 3.5-2 3 0 5.3 2.4 5.3 5.7Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M20 11.5a8 8 0 0 1-8 8H7l-4 2 1.4-4A8 8 0 1 1 20 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="m21 3-7.2 18-3.7-7.1L3 10.2 21 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m10.1 13.9 5.3-5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookmarkIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

const avatar =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80";

const stories = [
  {
    name: "قصتك",
    image: avatar,
    own: true,
  },
  {
    name: "سارة",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
  },
  {
    name: "علي",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
  },
  {
    name: "نور",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
  },
  {
    name: "حسن",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80",
  },
];

const posts = [
  {
    id: 1,
    username: "سيف الموصلي",
    location: "الموصل، العراق",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
    image:
      "https://images.unsplash.com/photo-1596395819057-e37f55a8516a?w=1200&q=85",
    likes: 248,
    caption: "الموصل دائماً إلها مكان خاص بالقلب 🇮🇶",
    comments: 31,
    time: "قبل ساعتين",
  },
  {
    id: 2,
    username: "نور علي",
    location: "أربيل، العراق",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85",
    likes: 512,
    caption: "أحياناً كل اللي تحتاجه هو مكان هادئ.",
    comments: 44,
    time: "قبل 4 ساعات",
  },
];

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">ع</span>
            <span>إنستعراق</span>
          </Link>

          <div className="top-actions">
            <Link to="/explore" className="icon-button mobile-hide">
              <SearchIcon />
            </Link>

            <Link to="/notifications" className="icon-button notification-button">
              <BellIcon />
              <span className="notification-dot" />
            </Link>

            <button
              className="profile-mini"
              onClick={() => navigate("/profile")}
            >
              <img src={avatar} alt="حسابي" />
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
                <img src={avatar} alt="" />
              </span>
              <span>حسابي</span>
            </NavLink>
          </nav>

          <Link to="/create" className="create-button">
            <PlusIcon size={20} />
            <span>إنشاء منشور</span>
          </Link>

          <div className="sidebar-footer">
            <span>إنستعراق</span>
            <span>•</span>
            <span>نسخة تجريبية</span>
          </div>
        </aside>

        {children}

        <aside className="right-panel">
          <div className="profile-card">
            <div className="profile-row">
              <img src={avatar} alt="ذنون" />

              <div>
                <strong>ذنون</strong>
                <span>@dhnoun</span>
              </div>

              <Link to="/profile">تعديل</Link>
            </div>
          </div>

          <div className="suggestions">
            <div className="suggestions-title">
              <strong>حسابات مقترحة</strong>
              <Link to="/explore">عرض الكل</Link>
            </div>

            {stories.slice(1).map((story) => (
              <div className="suggestion" key={story.name}>
                <img src={story.image} alt={story.name} />

                <div>
                  <strong>{story.name}</strong>
                  <span>مقترح لك</span>
                </div>

                <button>متابعة</button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <nav className="mobile-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
        >
          <HomeIcon />
          <span>الرئيسية</span>
        </NavLink>

        <NavLink
          to="/explore"
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
        >
          <SearchIcon />
          <span>استكشاف</span>
        </NavLink>

        <Link to="/create" className="nav-add">
          <PlusIcon size={25} />
        </Link>

        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
        >
          <BellIcon />
          <span>الإشعارات</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
        >
          <span className="nav-avatar">
            <img src={avatar} alt="" />
          </span>
          <span>حسابي</span>
        </NavLink>
      </nav>
    </div>
  );
}

function HomePage() {
  const [likedPosts, setLikedPosts] = useState<number[]>([]);
  const [savedPosts, setSavedPosts] = useState<number[]>([]);

  const toggleLike = (id: number) => {
    setLikedPosts((current) =>
      current.includes(id)
        ? current.filter((postId) => postId !== id)
        : [...current, id],
    );
  };

  const toggleSave = (id: number) => {
    setSavedPosts((current) =>
      current.includes(id)
        ? current.filter((postId) => postId !== id)
        : [...current, id],
    );
  };

  return (
    <main className="feed-container">
      <section className="stories-card">
        <div className="section-heading">
          <h2>القصص</h2>
          <Link to="/stories">مشاهدة الكل</Link>
        </div>

        <div className="stories-row">
          {stories.map((story) => (
            <Link
              to={story.own ? "/create" : `/stories/${story.name}`}
              className="story"
              key={story.name}
            >
              <div className={`story-ring ${story.own ? "own" : ""}`}>
                <div className="story-image">
                  <img src={story.image} alt={story.name} />
                </div>

                {story.own && (
                  <span className="story-plus">
                    <PlusIcon size={12} strokeWidth={2.5} />
                  </span>
                )}
              </div>

              <span>{story.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="feed-heading">
        <div>
          <p>أحدث المنشورات</p>
          <h1>لك اليوم</h1>
        </div>

        <button className="filter-button">لك ▾</button>
      </div>

      <section className="posts">
        {posts.map((post) => {
          const liked = likedPosts.includes(post.id);
          const saved = savedPosts.includes(post.id);

          return (
            <article className="post-card" key={post.id}>
              <header className="post-header">
                <Link to={`/u/${encodeURIComponent(post.username)}`} className="post-user">
                  <img src={post.avatar} alt={post.username} />

                  <div>
                    <strong>{post.username}</strong>
                    <span>{post.location}</span>
                  </div>
                </Link>

                <button className="more-button">
                  <MoreIcon />
                </button>
              </header>

              <Link to={`/post/${post.id}`} className="post-media">
                <img src={post.image} alt={post.caption} />
              </Link>

              <div className="post-actions">
                <div className="actions-left">
                  <button
                    className={liked ? "action liked" : "action"}
                    onClick={() => toggleLike(post.id)}
                  >
                    <HeartIcon filled={liked} />
                  </button>

                  <Link to={`/post/${post.id}#comments`} className="action">
                    <CommentIcon />
                  </Link>

                  <button
                    className="action"
                    onClick={() => {
                      const url = `${window.location.origin}/post/${post.id}`;
                      navigator.clipboard?.writeText(url);
                    }}
                  >
                    <SendIcon />
                  </button>
                </div>

                <button
                  className={saved ? "action saved" : "action"}
                  onClick={() => toggleSave(post.id)}
                >
                  <BookmarkIcon />
                </button>
              </div>

              <div className="post-content">
                <strong>
                  {(liked ? post.likes + 1 : post.likes).toLocaleString(
                    "ar-IQ",
                  )}{" "}
                  إعجاب
                </strong>

                <p>
                  <Link to={`/u/${encodeURIComponent(post.username)}`}>
                    <b>{post.username}</b>
                  </Link>{" "}
                  {post.caption}
                </p>

                <Link
                  to={`/post/${post.id}#comments`}
                  className="comments-link"
                >
                  عرض كل التعليقات ({post.comments})
                </Link>

                <time>{post.time}</time>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function SimplePage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <main className="feed-container">
      <section
        className="stories-card"
        style={{ minHeight: 420, display: "grid", placeItems: "center" }}
      >
        <div style={{ textAlign: "center", padding: 30 }}>
          <div style={{ marginBottom: 20 }}>{icon}</div>
          <h1>{title}</h1>
          <p style={{ color: "#777", marginTop: 10 }}>{description}</p>
        </div>
      </section>
    </main>
  );
}

function PostPage() {
  const id = window.location.pathname.split("/").pop();

  const post = posts.find((item) => String(item.id) === id) ?? posts[0];

  return (
    <main className="feed-container">
      <article className="post-card">
        <header className="post-header">
          <Link to={`/u/${encodeURIComponent(post.username)}`} className="post-user">
            <img src={post.avatar} alt={post.username} />
            <div>
              <strong>{post.username}</strong>
              <span>{post.location}</span>
            </div>
          </Link>
        </header>

        <div className="post-media">
          <img src={post.image} alt={post.caption} />
        </div>

        <div className="post-content">
          <strong>{post.likes.toLocaleString("ar-IQ")} إعجاب</strong>
          <p>
            <b>{post.username}</b> {post.caption}
          </p>

          <div id="comments" style={{ marginTop: 25 }}>
            <strong>التعليقات</strong>
            <p style={{ color: "#777", marginTop: 10 }}>
              صفحة التعليقات جاهزة للربط بالـ API لاحقاً.
            </p>
          </div>
        </div>
      </article>
    </main>
  );
}

function ProfilePage() {
  return (
    <main className="feed-container">
      <section className="stories-card">
        <div className="profile-row" style={{ padding: 25 }}>
          <img src={avatar} alt="ذنون" style={{ width: 90, height: 90, borderRadius: "50%" }} />
          <div>
            <h1>ذنون</h1>
            <span>@dhnoun</span>
          </div>
        </div>

        <div style={{ padding: "0 25px 25px" }}>
          <p>حسابي على إنستعراق 🇮🇶</p>
          <p style={{ color: "#777" }}>0 منشور · 0 متابع · 0 يتابع</p>
        </div>
      </section>
    </main>
  );
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/explore"
          element={
            <SimplePage
              title="استكشاف"
              description="هنا راح تظهر المنشورات والحسابات الرائجة."
              icon={<SearchIcon size={52} />}
            />
          }
        />

        <Route
          path="/notifications"
          element={
            <SimplePage
              title="الإشعارات"
              description="هنا راح تظهر الإعجابات والتعليقات والمتابعات."
              icon={<BellIcon size={52} />}
            />
          }
        />

        <Route
          path="/saved"
          element={
            <SimplePage
              title="المحفوظات"
              description="المنشورات التي تحفظها ستظهر هنا."
              icon={<BookmarkIcon size={52} />}
            />
          }
        />

        <Route
          path="/create"
          element={
            <SimplePage
              title="إنشاء منشور"
              description="صفحة إنشاء المنشورات جاهزة، وسنربط رفع الصور والفيديو بالـ API."
              icon={<PlusIcon size={52} />}
            />
          }
        />

        <Route
          path="/stories"
          element={
            <SimplePage
              title="القصص"
              description="هنا ستظهر جميع القصص."
              icon={<HeartIcon size={52} />}
            />
          }
        />

        <Route path="/stories/:username" element={<SimplePage title="القصة" description="صفحة القصة." icon={<HeartIcon size={52} />} />} />

        <Route path="/profile" element={<ProfilePage />} />

        <Route path="/u/:username" element={<ProfilePage />} />

        <Route path="/post/:id" element={<PostPage />} />

        <Route
          path="*"
          element={
            <SimplePage
              title="الصفحة غير موجودة"
              description="الرابط الذي فتحته غير موجود."
              icon={<SearchIcon size={52} />}
            />
          }
        />
      </Routes>
    </Layout>
  );
}

export default App;
