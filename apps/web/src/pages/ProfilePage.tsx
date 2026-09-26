import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { avatar } from "../data/stories";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type ProfileUser = {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
};

type ProfilePost = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  likeCount: number;
};

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('INVALID_IMAGE'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('READ_ERROR'));
    reader.readAsDataURL(file);
  });
}

function cropAvatar(file: File, zoom: number, offsetX: number, offsetY: number): Promise<string> {
  return readImage(file).then((img) => {
    const sourceSize = Math.min(img.width, img.height) / zoom;
    const maxX = (img.width - sourceSize) / 2;
    const maxY = (img.height - sourceSize) / 2;
    const sx = Math.max(0, Math.min(img.width - sourceSize, maxX + offsetX * maxX));
    const sy = Math.max(0, Math.min(img.height - sourceSize, maxY + offsetY * maxY));

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('CANVAS_ERROR');

    ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, 512, 512);
    return canvas.toDataURL('image/jpeg', 0.86);
  });
}

export default function ProfilePage() {
  const { username: routeUsername } = useParams<{ username: string }>();
  const { user: currentUser, token, accounts, logout, switchAccount, login } = useAuth();
  const navigate = useNavigate();

  const isOwnProfile = !routeUsername || routeUsername === currentUser?.username;
  const [profile, setProfile] = useState<ProfileUser | null>(isOwnProfile ? (currentUser as ProfileUser | null) : null);
  const [profilePosts, setProfilePosts] = useState<ProfilePost[]>([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [profileLoading, setProfileLoading] = useState(!isOwnProfile);
  const [profileError, setProfileError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    if (isOwnProfile) {
      setProfile(currentUser as ProfileUser | null);
      setProfilePosts([]);
      setStats((s) => ({ ...s, posts: 0 }));
      setProfileLoading(false);
      return () => { cancelled = true; };
    }
    if (!routeUsername) return;

    void fetch(`${API_URL}/auth/users/${encodeURIComponent(routeUsername)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'PROFILE_FAILED');
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setProfile(data.user);
          setProfilePosts(data.posts ?? []);
          setStats(data.stats ?? { posts: data.posts?.length ?? 0, followers: 0, following: 0 });
        }
      })
      .catch((error) => {
        if (!cancelled) setProfileError(error instanceof Error ? error.message : 'تعذر تحميل الحساب');
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, routeUsername, token, currentUser]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddAccount = () => navigate('/login');

  const handleChoosePhoto = () => fileInputRef.current?.click();

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('اختار صورة فقط');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('الصورة لازم تكون أقل من 10 ميگابايت');
      return;
    }
    setPhotoError('');
    setSelectedFile(file);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const savePhoto = async () => {
    if (!selectedFile || !token || !currentUser) return;
    setSavingPhoto(true);
    setPhotoError('');

    try {
      const avatarUrl = await cropAvatar(selectedFile, zoom, offsetX, offsetY);
      const response = await fetch(`${API_URL}/auth/avatar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'UPLOAD_FAILED');

      login(data.user, token);
      setProfile(data.user);
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      setPhotoError('تعذر حفظ الصورة، حاول مرة ثانية');
    } finally {
      setSavingPhoto(false);
    }
  };

  const currentAvatar = profile?.avatarUrl || avatar;
  const title = profile?.displayName || profile?.username || 'زائر';

  if (profileLoading) {
    return <main className="feed-container"><section className="profile-page-card"><p>جاري تحميل الحساب...</p></section></main>;
  }

  if (profileError || !profile) {
    return <main className="feed-container"><section className="profile-page-card"><strong>الحساب غير موجود</strong><p>{profileError || 'تعذر تحميل الملف الشخصي.'}</p></section></main>;
  }

  return (
    <main className="feed-container">
      <section className="profile-page-card">
        <div className="profile-cover" />
        <div className="profile-main">
          <div className="profile-avatar-wrap">
            <img className="profile-avatar" src={currentAvatar} alt={title} />
            {isOwnProfile && (
              <>
                <button
                  type="button"
                  className="profile-camera"
                  onClick={handleChoosePhoto}
                  disabled={savingPhoto}
                  aria-label="تغيير صورة الحساب"
                >
                  {savingPhoto ? '…' : '📷'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} hidden />
              </>
            )}
          </div>

          <div className="profile-identity">
            <h1>{title}</h1>
            <p>@{profile.username}</p>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>

          {isOwnProfile && <button type="button" className="profile-edit">تعديل الملف</button>}
        </div>

        <div className="profile-stats">
          <div><strong>{stats.posts}</strong><span>منشور</span></div>
          <div><strong>{stats.followers}</strong><span>متابع</span></div>
          <div><strong>{stats.following}</strong><span>يتابع</span></div>
        </div>

        <div className="profile-posts">
          {profilePosts.length === 0 ? (
            <p className="profile-empty">ماكو منشورات بهذا الحساب حالياً.</p>
          ) : (
            profilePosts.map((post) => (
              <article className="profile-post" key={post.id}>
                {post.mediaUrl && <img src={post.mediaUrl} alt={post.content || 'منشور'} />}
                {post.content && <p>{post.content}</p>}
                <span>{post.likeCount.toLocaleString('ar-IQ')} إعجاب</span>
              </article>
            ))
          )}
        </div>

        {selectedFile && (
          <div className="avatar-crop-panel">
            <div className="crop-preview">
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="معاينة قص الصورة"
                style={{
                  transform: `translate(${offsetX * 12}%, ${offsetY * 12}%) scale(${zoom})`,
                }}
              />
            </div>
            <label>
              تكبير الصورة
              <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
            <div className="crop-offsets">
              <label>يمين / يسار<input type="range" min="-1" max="1" step="0.01" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} /></label>
              <label>أعلى / أسفل<input type="range" min="-1" max="1" step="0.01" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} /></label>
            </div>
            <div className="crop-actions">
              <button type="button" onClick={() => setSelectedFile(null)}>إلغاء</button>
              <button type="button" onClick={() => void savePhoto()} disabled={savingPhoto}>حفظ الصورة</button>
            </div>
          </div>
        )}

        {photoError && <p className="profile-error">{photoError}</p>}

        {isOwnProfile && (
          <>
            <div className="profile-bio-block">
              <p>حسابي على إنستعراق 🇮🇶</p>
            </div>
            {accounts.length > 1 && (
              <div className="profile-accounts">
                <strong>حساباتك:</strong>
                {accounts.map((acc) => (
                  <button key={acc.user.id} type="button" onClick={() => switchAccount(acc.user.id)}>
                    @{acc.user.username} {acc.user.id === currentUser?.id && '✓'}
                  </button>
                ))}
              </div>
            )}
            <div className="profile-footer-actions">
              <button type="button" onClick={handleAddAccount}>إضافة حساب</button>
              <button type="button" onClick={handleLogout}>تسجيل خروج</button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
