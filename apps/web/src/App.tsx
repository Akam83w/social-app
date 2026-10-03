import React from "react";
import { SearchIcon, BellIcon } from "./components/icons/Icons";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import "./index.css";
import "./social-features.css";
import Layout from "./components/layout/Layout";
// Start downloading the first screen immediately so the splash time is used for real work.
const homePageModule = import("./pages/HomePage");
const HomePage = React.lazy(() => homePageModule);
const PostPage = React.lazy(() => import("./pages/PostPage"));
const SimplePage = React.lazy(() => import("./pages/SimplePage"));
const ExplorePage = React.lazy(() => import("./pages/ExplorePage"));
const CreatePostPage = React.lazy(() => import("./pages/CreatePostPage"));
const CreateStoryPage = React.lazy(() => import("./pages/CreateStoryPage"));
const ReelsPage = React.lazy(() => import("./pages/ReelsPage"));
const MessagesPage = React.lazy(() => import("./pages/MessagesPage"));
const CallPage = React.lazy(() => import("./pages/MessagesPage").then(m => ({ default: m.CallPage })));
const NotificationsLivePage = React.lazy(() => import("./pages/MessagesPage").then(m => ({ default: m.NotificationsLivePage })));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const AccountSettingsPage = React.lazy(() => import("./pages/AccountSettingsPage"));
const HashtagPage = React.lazy(() => import("./pages/HashtagPage"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const OAuthCallbackPage = React.lazy(() => import("./pages/OAuthCallbackPage"));
const RegisterPage = React.lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = React.lazy(() => import("./pages/ForgotPasswordPage"));
const PolicyPage = React.lazy(() => import("./pages/PolicyPage"));
const SavedPage = React.lazy(() => import("./pages/SavedPage"));
import { useAuth } from "./context/AuthContext";
import { prefetchApi } from "./lib/api";
const NativePushBootstrap = React.lazy(() => import("./NativePushBootstrap"));

function QXSplash({ onDone }: { onDone: () => void }) {
  React.useEffect(() => {
    const timer = window.setTimeout(onDone, 3000);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="qx-splash" dir="rtl" aria-label="QX">
      <div className="qx-flag" aria-hidden="true">
        <div className="qx-flag-word">الله أكبر</div>
      </div>
      <div className="qx-splash-content">
        <div className="qx-logo" aria-label="QX">QX</div>
        <div className="qx-tagline">معًا بأيادي عراقية</div>
      </div>
    </div>
  );
}

function PersistentTabs() {
  const location = useLocation();
  const path = location.pathname;
  const tabs = ["/", "/explore", "/reels", "/messages", "/notifications", "/saved", "/profile"];
  const [visited, setVisited] = React.useState<string[]>(() => tabs.includes(path) ? [path] : []);
  const scrollPositions = React.useRef<Record<string, number>>({});
  const previousPath = React.useRef(path);

  React.useEffect(() => {
    if (tabs.includes(path)) {
      setVisited((current) => current.includes(path) ? current : [...current, path]);

      const from = previousPath.current;
      if (tabs.includes(from)) {
        scrollPositions.current[from] = window.scrollY;
      }
      previousPath.current = path;

      const savedY = scrollPositions.current[path] ?? 0;
      window.requestAnimationFrame(() => window.scrollTo(0, savedY));
    }
  }, [path]);

  const isVisited = (target: string) => visited.includes(target);
  const isVisible = (target: string) => path === target;

  return (
    <React.Suspense fallback={<main className="feed-container"><section className="stories-card"><p>جاري تحميل الصفحة...</p></section></main>}>
      <>
      {isVisited("/") && <div style={{display:isVisible("/") ? "block" : "none"}}><HomePage /></div>}
      {isVisited("/explore") && <div style={{display:isVisible("/explore") ? "block" : "none"}}><ExplorePage /></div>}
      {isVisited("/reels") && <div style={{display:isVisible("/reels") ? "block" : "none"}}><ReelsPage /></div>}
      {isVisited("/messages") && <div style={{display:isVisible("/messages") ? "block" : "none"}}><MessagesPage /></div>}
      {isVisited("/notifications") && <div style={{display:isVisible("/notifications") ? "block" : "none"}}><NotificationsLivePage /></div>}
      {isVisited("/saved") && <div style={{display:isVisible("/saved") ? "block" : "none"}}><SavedPage /></div>}
      {isVisited("/profile") && <div style={{display:isVisible("/profile") ? "block" : "none"}}><ProfilePage /></div>}
      </>
    </React.Suspense>
  );
}

function RouteScrollReset() {
  const { pathname } = useLocation();
  const previousPath = React.useRef(pathname);

  React.useEffect(() => {
    const persistentTabs = ["/", "/explore", "/reels", "/messages", "/notifications", "/saved", "/profile"];
    if (!persistentTabs.includes(pathname)) {
      window.scrollTo(0, 0);
    }
    previousPath.current = pathname;
  }, [pathname]);

  return null;
}

function ProtectedApp() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <React.Suspense fallback={<main className="feed-container"><section className="stories-card"><p>جاري تحميل الصفحة...</p></section></main>}>
    <Layout>
      <RouteScrollReset />
      <PersistentTabs />
      <Routes>
        <Route path="/call" element={<CallPage />} />
        <Route path="/create" element={<CreatePostPage />} />
        <Route path="/create-post" element={<CreatePostPage />} />
        <Route path="/create-story" element={<CreateStoryPage />} />
        <Route
          path="/stories"
          element={
            <SimplePage
              title="القصص"
              description="هنا ستظهر جميع القصص."
              icon={<BellIcon size={52} />}
            />
          }
        />
        <Route
          path="/stories/:username"
          element={
            <SimplePage
              title="القصة"
              description="صفحة القصة."
              icon={<BellIcon size={52} />}
            />
          }
        />
        <Route path="/hashtag/:tag" element={<HashtagPage />} />
        <Route path="/profile/settings" element={<AccountSettingsPage />} />
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
    </React.Suspense>
  );
}

function App() {
  const { token, user } = useAuth();
  const [showSplash, setShowSplash] = React.useState(() => {
    // The Iraqi splash is an install/first-launch experience only.
    // A normal browser refresh must keep the current route and open directly there.
    try {
      return localStorage.getItem("qx_splash_seen") !== "1";
    } catch {
      return true;
    }
  });

  const finishSplash = React.useCallback(() => {
    try {
      localStorage.setItem("qx_splash_seen", "1");
    } catch {
      // Ignore storage failures; the app can still continue normally.
    }
    setShowSplash(false);
  }, []);

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // Start the whole app warm-up immediately, even while the splash is visible.
    // This removes the old "open page first, then start loading it" waterfall.
    const warmApp = async () => {
      const routeChunks = [
        import("./pages/ExplorePage"),
        import("./pages/ReelsPage"),
        import("./pages/MessagesPage"),
        import("./pages/ProfilePage"),
        import("./pages/SavedPage"),
        import("./pages/AccountSettingsPage"),
        import("./pages/PostPage"),
      ];

      const dataRequests = [
        prefetchApi("/posts?limit=20", token, 30_000),
        prefetchApi("/stories", token, 30_000),
        prefetchApi("/posts?limit=30", token, 30_000),
        prefetchApi("/posts/explore?limit=30", token, 30_000),
        prefetchApi("/messages", token, 15_000),
        prefetchApi("/messages/notes", token, 15_000),
        prefetchApi("/presence/active", token, 15_000),
        prefetchApi("/notifications", token, 15_000),
        prefetchApi("/notifications/config", token, 30_000),
        prefetchApi("/posts?limit=50", token, 15_000),
      ];

      const profileRequests = user?.username
        ? [prefetchApi("/auth/users/" + encodeURIComponent(user.username), token, 30_000)]
        : [];

      const results = await Promise.allSettled([...routeChunks, ...dataRequests, ...profileRequests]);
      if (cancelled) return;

      // Warm the most important profile pictures without downloading post videos/images.
      const avatarUrls = new Set<string>();
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const collect = (value: unknown) => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) { value.forEach(collect); return; }
          for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            if (key === "avatarUrl" && typeof child === "string" && child.startsWith("http")) avatarUrls.add(child);
            else if (key !== "mediaUrl" && key !== "mediaPoster") collect(child);
            if (avatarUrls.size >= 40) return;
          }
        };
        collect(result.value);
        if (avatarUrls.size >= 40) break;
      }
      avatarUrls.forEach(url => {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
      });
    };

    void warmApp();
    return () => { cancelled = true; };
  }, [token, user?.username]);

  if (showSplash) {
    return <QXSplash onDone={finishSplash} />;
  }

  return (
    <>
      <React.Suspense fallback={null}>
        <NativePushBootstrap />
      </React.Suspense>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/policy" element={<PolicyPage />} />
        <Route path="*" element={<ProtectedApp />} />
      </Routes>
    </>
  );
}

export default App;
