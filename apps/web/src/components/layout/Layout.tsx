import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  SearchIcon,
  PlusIcon,
  BellIcon,
  BookmarkIcon,
} from "../icons/Icons";

type LayoutProps = {
  children: React.ReactNode;
};

const avatar =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80";

const stories = [
  {
    name: "قصتك",
    image: avatar,
    own: true,
  },
  {
    name: "سارة",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
  },
  {
    name: "علي",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
  },
  {
    name: "نور",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
  },
  {
    name: "حسن",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80",
  },
];

export default function Layout({ children }: LayoutProps) {
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
