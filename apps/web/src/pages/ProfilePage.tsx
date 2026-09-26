import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { avatar } from "../data/stories";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const size = 320;
        const scale = Math.min(size / img.width, size / img.height, 1);

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('CANVAS_ERROR'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };

      img.onerror = () => reject(new Error('INVALID_IMAGE'));
      img.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error('READ_ERROR'));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, token, accounts, logout, switchAccount, login } = useAuth();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddAccount = () => {
    navigate('/login');
  };

  const handleChoosePhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
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

    if (!token || !user) {
      setPhotoError('سجّل دخول أولاً');
      return;
    }

    setSavingPhoto(true);
    setPhotoError('');

    try {
      const avatarUrl = await compressImage(file);

      const response = await fetch(`${API_URL}/auth/avatar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'UPLOAD_FAILED');
      }

      login(data.user, token);
    } catch (error: any) {
      console.error(error);
      setPhotoError('تعذر حفظ الصورة، حاول مرة ثانية');
    } finally {
      setSavingPhoto(false);
    }
  };

  const currentAvatar =
    (user as UserWithAvatar | null)?.avatarUrl || avatar;

  return (
    <main className="feed-container">
      <section className="stories-card">
        <div
          className="profile-row"
          style={{ padding: 25, alignItems: 'center' }}
        >
          <div style={{ position: 'relative' }}>
            <img
              src={currentAvatar}
              alt={user?.displayName || user?.username || "مستخدم"}
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />

            <button
              type="button"
              onClick={handleChoosePhoto}
              disabled={savingPhoto}
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: savingPhoto ? 'wait' : 'pointer',
                background: '#111',
                color: '#fff',
                fontSize: 16,
              }}
              aria-label="تغيير صورة الحساب"
            >
              {savingPhoto ? '…' : '📷'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />
          </div>

          <div>
            <h1>{user?.displayName || user?.username || "زائر"}</h1>
            <span>@{user?.username || "غير مسجل"}</span>
          </div>
        </div>

        {photoError && (
          <p style={{ color: '#c00', padding: '0 25px' }}>
            {photoError}
          </p>
        )}

        <div style={{ padding: "0 25px 25px" }}>
          <p>حسابي على إنستعراق 🇮🇶</p>
          <p style={{ color: "#777" }}>
            0 منشور · 0 متابع · 0 يتابع
          </p>
        </div>

        {accounts.length > 1 && (
          <div style={{ padding: "0 25px 15px" }}>
            <p style={{ fontWeight: "bold", marginBottom: 8 }}>حساباتك:</p>

            {accounts.map((acc) => (
              <button
                key={acc.user.id}
                onClick={() => switchAccount(acc.user.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "right",
                  padding: 8,
                  marginBottom: 4,
                  background:
                    acc.user.id === user?.id ? "#eee" : "transparent",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                }}
              >
                @{acc.user.username} {acc.user.id === user?.id && "✓"}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            padding: "0 25px 25px",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            onClick={handleAddAccount}
            style={{ flex: 1, padding: 10 }}
          >
            إضافة حساب
          </button>

          <button
            onClick={handleLogout}
            style={{ flex: 1, padding: 10 }}
          >
            تسجيل خروج
          </button>
        </div>
      </section>
    </main>
  );
}

type UserWithAvatar = {
  avatarUrl?: string | null;
};
