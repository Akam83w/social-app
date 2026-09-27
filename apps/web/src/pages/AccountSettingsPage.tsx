import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type EditableUser = { bio?: string | null; phone?: string | null };

export default function AccountSettingsPage() {
  const { user, token, login } = useAuth();
  const navigate = useNavigate();
  const editableUser = user as (typeof user & EditableUser);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState(editableUser?.phone || '');
  const [bio, setBio] = useState(editableUser?.bio || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const save = async () => {
    if (!token) return;
    setBusy(true); setMessage('');
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName, username, phone, bio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر حفظ التعديلات');
      login(data.user, token);
      setMessage('تم حفظ تعديلات الحساب.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'تعذر حفظ التعديلات');
    } finally {
      setBusy(false);
    }
  };

  return <main className="feed-container"><section className="profile-page-card account-settings">
    <button type="button" onClick={() => navigate('/profile')}>‹ رجوع</button>
    <h1>الإعدادات وتعديل الملف الشخصي</h1>
    <div className="settings-section"><h2>تعديل الملف الشخصي</h2>
      <label>الاسم<input value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>
      <label>اسم المستخدم<input value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ''))} /></label>
      <label>نبذة الحساب<textarea value={bio} onChange={e => setBio(e.target.value)} /></label>
    </div>
    <div className="settings-section"><h2>معلومات الاتصال</h2>
      <label>رقم الهاتف<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="رقم الهاتف" /></label>
      <label>البريد الإلكتروني<input value={user.email || ''} disabled /></label>
    </div>
    <div className="settings-section"><h2>الحساب</h2>
      <button type="button">تغيير كلمة المرور</button>
      <button type="button">الحسابات المرتبطة</button>
      <button type="button">الخصوصية والأمان</button>
      <button type="button">الإشعارات</button>
    </div>
    <button type="button" className="profile-edit" onClick={() => void save()} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button>
    {message && <p className="profile-error">{message}</p>}
  </section></main>;
}
