import { SearchIcon, BookmarkIcon, BellIcon } from "./components/icons/Icons";
import { Route, Routes, Navigate } from "react-router-dom";
import "./index.css";
import "./social-features.css";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import PostPage from "./pages/PostPage";
import SimplePage from "./pages/SimplePage";
import CreatePostPage from "./pages/CreatePostPage";
import CreateStoryPage from "./pages/CreateStoryPage";
import ReelsPage from "./pages/ReelsPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import { useAuth } from "./context/AuthContext";
function ProtectedApp(){const {isAuthenticated}=useAuth();if(!isAuthenticated)return <Navigate to="/login" replace/>;return <Layout><Routes>
<Route path="/" element={<HomePage/>}/><Route path="/explore" element={<SimplePage title="استكشاف" description="ابحث عن حساب باسم المستخدم وتابع الحسابات من هنا." icon={<SearchIcon size={52}/>}/>}/>
<Route path="/reels" element={<ReelsPage/>}/><Route path="/messages" element={<MessagesPage/>}/>
<Route path="/notifications" element={<SimplePage title="الإشعارات" description="هنا راح تظهر الإعجابات والتعليقات والمتابعات." icon={<BellIcon size={52}/>}/>}/><Route path="/saved" element={<SimplePage title="المحفوظات" description="المنشورات التي تحفظها ستظهر هنا." icon={<BookmarkIcon size={52}/>}/>}/>
<Route path="/create" element={<CreatePostPage/>}/><Route path="/create-story" element={<CreateStoryPage/>}/><Route path="/stories" element={<SimplePage title="القصص" description="هنا ستظهر جميع القصص." icon={<BellIcon size={52}/>}/>}/><Route path="/stories/:username" element={<SimplePage title="القصة" description="صفحة القصة." icon={<BellIcon size={52}/>}/>}/>
<Route path="/profile" element={<ProfilePage/>}/><Route path="/profile/settings" element={<AccountSettingsPage/>}/><Route path="/u/:username" element={<ProfilePage/>}/><Route path="/post/:id" element={<PostPage/>}/><Route path="*" element={<SimplePage title="الصفحة غير موجودة" description="الرابط الذي فتحته غير موجود." icon={<SearchIcon size={52}/>}/>}/>
</Routes></Layout>}
function App(){return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route path="/forgot-password" element={<ForgotPasswordPage/>}/><Route path="*" element={<ProtectedApp/>}/></Routes>}
export default App;
