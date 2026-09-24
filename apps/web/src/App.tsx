import { SearchIcon, PlusIcon, HeartIcon, BookmarkIcon, BellIcon } from "./components/icons/Icons";
import {
  Route,
  Routes,
} from "react-router-dom";
import "./index.css";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import PostPage from "./pages/PostPage";
import SimplePage from "./pages/SimplePage";
import ProfilePage from "./pages/ProfilePage";

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
