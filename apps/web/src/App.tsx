import React from "react";
import { SearchIcon, BellIcon } from "./components/icons/Icons";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import "./index.css";
import "./social-features.css";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import PostPage from "./pages/PostPage";
import SimplePage from "./pages/SimplePage";
import ExplorePage from "./pages/ExplorePage";
import CreatePostPage from "./pages/CreatePostPage";
import CreateStoryPage from "./pages/CreateStoryPage";
import ReelsPage from "./pages/ReelsPage";
import MessagesPage, { CallPage, NotificationsLivePage } from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import HashtagPage from "./pages/HashtagPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SavedPage from "./pages/SavedPage";
import { useAuth } from "./context/AuthContext";
import NativePushBootstrap from "./NativePushBootstrap";

function QXSplash({ onDone }: { onDone: () => void }) {
  React.useEffect(() => {
    const timer = window.setTimeout(onDone, 650);
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
    <>
      {isVisited("/") && <div style={{display:isVisible("/") ? "block" : "none"}}><HomePage /></div>}
      {isVisited("/explore") && <div style={{display:isVisible("/explore") ? "block" : "none"}}><ExplorePage /></div>}
      {isVisited("/reels") && <div style={{display:isVisible("/reels") ? "block" : "none"}}><ReelsPage /></div>}
      {isVisited("/messages") && <div style={{display:isVisible("/messages") ? "block" : "none"}}><MessagesPage /></div>}
      {isVisited("/notifications") && <div style={{display:isVisible("/notifications") ? "block" : "none"}}><NotificationsLivePage /></div>}
      {isVisited("/saved") && <div style={{display:isVisible("/saved") ? "block" : "none"}}><SavedPage /></div>}
      {isVisited("/profile") && <div style={{display:isVisible("/profile") ? "block" : "none"}}><ProfilePage /></div>}
    </>
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
  );
}

function App() {
  const [showSplash, setShowSplash] = React.useState(true);

  if (showSplash) {
    return <QXSplash onDone={() => setShowSplash(false)} />;
  }

  return (
    <>
      <NativePushBootstrap />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<ProtectedApp />} />
      </Routes>
    </>
  );
}

export default App;
