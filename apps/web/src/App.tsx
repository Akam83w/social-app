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
const LegalPage = React.lazy(() => import("./pages/LegalPage"));
const SavedPage = React.lazy(() => import("./pages/SavedPage"));
const ModerationPage = React.lazy(() => import("./pages/ModerationPage"));
import { useAuth } from "./context/AuthContext";
import { prefetchApi } from "./lib/api";
const NativePushBootstrap = React.lazy(() => import("./NativePushBootstrap"));

function QXSplash({ onDone }: { onDone: () => void }) {
  React.useEffect(() => {
    const timer = window.setTimeout(onDone, 3000);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="qx-splash" dir="rtl" aria-label="نهر دجلة والعلم العراقي">
      <svg className="qx-dijla-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="dijla-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#102d3d" />
            <stop offset="0.48" stopColor="#4e9c9d" />
            <stop offset="0.76" stopColor="#e0b875" />
            <stop offset="1" stopColor="#f3d99d" />
          </linearGradient>
          <linearGradient id="dijla-water" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#174d60" />
            <stop offset="0.45" stopColor="#167f83" />
            <stop offset="1" stopColor="#4db4a0" />
          </linearGradient>
          <radialGradient id="dijla-sun">
            <stop offset="0" stopColor="#fff4c6" stopOpacity=".95" />
            <stop offset=".45" stopColor="#ffd98a" stopOpacity=".42" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="dijla-flag-red" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8e0b1a" />
            <stop offset=".5" stopColor="#ce1126" />
            <stop offset="1" stopColor="#e33a4c" />
          </linearGradient>
          <linearGradient id="dijla-flag-white" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d9d9d9" />
            <stop offset=".5" stopColor="#fff" />
            <stop offset="1" stopColor="#f7f7f7" />
          </linearGradient>
          <linearGradient id="dijla-flag-black" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#050505" />
            <stop offset=".5" stopColor="#171717" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <filter id="dijla-blur"><feGaussianBlur stdDeviation="20" /></filter>
          <filter id="dijla-soft"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>

        <rect width="1080" height="1920" fill="url(#dijla-sky)" />
        <circle cx="740" cy="790" r="330" fill="url(#dijla-sun)" filter="url(#dijla-blur)" />
        <circle cx="740" cy="790" r="82" fill="#ffe5a3" opacity=".82" />

        <g fill="#172e34" opacity=".82">
          <path d="M0 1030 L0 910 55 900 55 850 92 850 92 930 135 930 135 875 175 875 175 955 230 955 230 820 278 820 278 920 320 920 320 845 360 845 360 955 420 955 420 800 475 800 475 925 525 925 525 870 570 870 570 950 635 950 635 790 690 790 690 930 740 930 740 845 785 845 785 940 850 940 850 810 900 810 900 925 950 925 950 860 1000 860 1000 935 1080 935 1080 1120 0 1120 Z" />
        </g>

        <g fill="none" stroke="#d9b16c" strokeWidth="10" opacity=".75">
          <path d="M70 1000 Q540 870 1010 1000" />
          <path d="M70 1022 Q540 892 1010 1022" />
          <path d="M70 1044 Q540 914 1010 1044" />
        </g>

        <path d="M0 1080 Q250 1000 540 1110 T1080 1060 L1080 1920 L0 1920 Z" fill="url(#dijla-water)" />
        <g className="qx-water-lines" fill="none" stroke="#b9eee0" strokeLinecap="round" opacity=".32">
          <path d="M-30 1210 Q260 1150 560 1215 T1110 1190" />
          <path d="M40 1320 Q320 1260 650 1328 T1120 1295" />
          <path d="M-20 1460 Q300 1390 620 1470 T1100 1440" />
          <path d="M90 1610 Q350 1540 700 1615 T1100 1590" />
          <path d="M-30 1760 Q300 1690 610 1765 T1120 1730" />
        </g>

        <g fill="#102e2b">
          <path d="M0 1100 Q130 1020 275 1090 L350 1180 0 1250 Z" />
          <path d="M1080 1080 Q930 1010 800 1080 L735 1160 1080 1240 Z" />
        </g>

        <g transform="translate(135 360)">
          <rect x="0" y="0" width="12" height="1180" rx="6" fill="#d7d7d2" />
          <circle cx="6" cy="0" r="17" fill="#e8d49a" />
          <g className="qx-iraqi-flag">
            <path d="M12 70 C120 25 270 80 410 35 C540 -5 640 40 760 92 L760 345 C620 292 530 280 410 320 C265 368 125 305 12 350 Z" fill="url(#dijla-flag-red)" />
            <path d="M12 150 C125 105 270 160 410 115 C540 75 640 120 760 172 L760 265 C620 212 530 200 410 240 C265 288 125 225 12 270 Z" fill="url(#dijla-flag-white)" />
            <path d="M12 265 C125 220 270 275 410 230 C540 190 640 235 760 287 L760 345 C620 292 530 280 410 320 C265 368 125 305 12 350 Z" fill="url(#dijla-flag-black)" />
            <text x="275" y="230" fill="#0b8f4d" fontSize="74" fontWeight="900" fontFamily="Arial, sans-serif">الله أكبر</text>
          </g>
        </g>

        <g fill="#183e38" opacity=".9">
          <path d="M85 1130 Q120 980 155 1130 Z" /><path d="M160 1150 Q195 970 230 1150 Z" />
          <path d="M880 1150 Q915 965 950 1150 Z" /><path d="M955 1130 Q990 985 1025 1130 Z" />
        </g>

        <rect width="1080" height="1920" fill="url(#dijla-sky)" opacity=".08" />
      </svg>
      <div className="qx-splash-vignette" aria-hidden="true" />
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
        <Route path="/moderation" element={<ModerationPage />} />
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
  // The Dijla opening scene is the app's real launch screen.
  // It runs on every app mount and on a genuine background -> foreground resume.
  const [showSplash, setShowSplash] = React.useState(true);
  const hiddenAtRef = React.useRef<number | null>(null);

  const finishSplash = React.useCallback(() => {
    setShowSplash(false);
  }, []);

  React.useEffect(() => {
    const show = () => setShowSplash(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState === "visible" && hiddenAtRef.current !== null) {
        const hiddenFor = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenFor >= 1500) show();
      }
    };

    window.addEventListener("sdm:show-launch-splash", show);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("sdm:show-launch-splash", show);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // Keep first paint light: only warm data required by the home screen.
    // Everything else is loaded lazily when the user actually opens it.
    const warmHome = async () => {
      await Promise.allSettled([
        prefetchApi("/posts?limit=20", token, 30_000),
        prefetchApi("/stories", token, 30_000),
      ]);
    };

    void warmHome();

    // Non-critical routes/data are intentionally deferred until the browser is idle.
    // This prevents the login -> app transition from competing with the first screen.
    const idle = (window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    }).requestIdleCallback;

    const warmNonCritical = () => {
      if (cancelled) return;
      void Promise.allSettled([
        import("./pages/ExplorePage"),
        import("./pages/ReelsPage"),
        import("./pages/MessagesPage"),
        import("./pages/ProfilePage"),
      ]);
      void Promise.allSettled([
        prefetchApi("/notifications", token, 15_000),
        prefetchApi("/notifications/config", token, 30_000),
      ]);
    };

    const idleId = idle
      ? idle(warmNonCritical, { timeout: 4_000 })
      : window.setTimeout(warmNonCritical, 1_500);

    return () => {
      cancelled = true;
      if (idle && typeof idleId === "number") {
        idleId && (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idleId);
      } else {
        window.clearTimeout(idleId as number);
      }
    };
  }, [token]);

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
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="*" element={<ProtectedApp />} />
      </Routes>
    </>
  );
}

export default App;
