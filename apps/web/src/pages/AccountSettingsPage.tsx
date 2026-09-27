import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type EditableUser = { bio?: string | null; phone?: string | null };

type Section = 'home' | 'edit' | 'personal' | 'security' | 'privacy' | 'notifications' | 'linked' | 'activity';

const rows: Array<{ id: Exclude<Section, 'home'>; title: string; description: string; icon: string }> = [
  { id: 'edit', title: 'تعديل الملف الشخصي', description: 'الاسم، اسم المستخدم، النبذة والصورة الشخصية', icon: '👤' },
  { id: 'personal', title: 'المعلومات الشخصية', description: 'رقم الهاتف والبريد الإلكتروني', icon: '🪪' },
  { id: 'security', title: 'كلمة السر والأمان', description: 'كلمة المرور وأمان تسجيل الدخول', icon: '🔐' },
  { id: 'privacy', title: 'الخصوصية', description: 'الحساب الخاص، الرسائل والتفاعل معك', icon: '🛡️' },
  { id: 'notifications', title: 'الإشعارات', description: 'الإعجابات، التعليقات، المتابعون والرسائل', icon: '🔔' },
  { id: 'linked', title: 'الحسابات المرتبطة', description: 'إدارة الحسابات المرتبطة وتسجيل الدخول', icon: '🔗' },
  { id: 'activity', title: 'نشاطك', description: 'المنشورات، القصص، المحفوظات وسجل النشاط', icon: '◷' },
];

export default function AccountSettingsPage() {
  const { user, token, login } = useAuth();
  const navigate = useNavigate();
  const editableUser = user as (typeof user & EditableUser);
  const [section, setSection] = useState<Section>('home');
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
      setUsername(data.user.username);
      setMessage('تم حفظ التعديلات بنجاح.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'تعذر حفظ التعديلات');
    } finally {
      setBusy(false);
    }
  };

  const go = (id: Section) => { setMessage(''); setSection(id); };

  const back = () => section === 'home' ? navigate('/profile') : setSection('home');

  const field = (label: string, value: string, setValue: (v: string) => void, placeholder = '') => (
    <label className="settings-field">
      <span>{label}</span>
      <input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} />
    </label>
  );

  return (
    <main className="feed-container">
      <section className="account-settings-shell">
        <header className="settings-header">
          <button type="button" className="settings-back" onClick={back}>‹</button>
          <div><h1>{section === 'home' ? 'الإعدادات' : rows.find(r => r.id === section)?.title}</h1><small>{section === 'home' ? 'إدارة حسابك وتجربتك' : 'إعدادات الحساب'}</small></div>
        </header>

        {section === 'home' && (
          <>
            <div className="settings-profile-card">
              <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`} alt="" />
              <div><strong>{user.displayName || user.username}</strong><span>@{user.username}</span></div>
              <button type="button" onClick={() => go('edit')}>تعديل</button>
            </div>

            <div className="settings-group">
              <h2>الحساب</h2>
              {rows.slice(0, 2).map(r => <button className="settings-row" type="button" key={r.id} onClick={() => go(r.id)}><b className="settings-icon">{r.icon}</b><span><strong>{r.title}</strong><small>{r.description}</small></span><b>›</b></button>)}
            </div>

            <div className="settings-group">
              <h2>الأمان والخصوصية</h2>
              {rows.slice(2, 4).map(r => <button className="settings-row" type="button" key={r.id} onClick={() => go(r.id)}><b className="settings-icon">{r.icon}</b><span><strong>{r.title}</strong><small>{r.description}</small></span><b>›</b></button>)}
            </div>

            <div className="settings-group">
              <h2>كيف تستخدم التطبيق</h2>
              {rows.slice(4).map(r => <button className="settings-row" type="button" key={r.id} onClick={() => go(r.id)}><b className="settings-icon">{r.icon}</b><span><strong>{r.title}</strong><small>{r.description}</small></span><b>›</b></button>)}
            </div>

            <div className="settings-group">
              <button className="settings-row danger" type="button" onClick={() => navigate('/profile')}><b className="settings-icon">↩</b><span><strong>العودة إلى الحساب</strong><small>إغلاق الإعدادات</small></span><b>›</b></button>
            </div>
          </>
        )}

        {section === 'edit' && (
          <div className="settings-detail">
            <div className="settings-avatar-editor">
              <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`} alt="" />
              <button type="button" onClick={() => navigate('/profile')}>تغيير صورة الملف الشخصي</button>
            </div>
            {field('الاسم', displayName, setDisplayName, 'اسمك الظاهر')}
            {field('اسم المستخدم', username, v => setUsername(v.replace(/^@/, '')), '@username')}
            <label className="settings-field"><span>نبذة الحساب</span><textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} placeholder="اكتب نبذة عنك..." /></label>
            <button className="settings-save" type="button" onClick={() => void save()} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button>
            {message && <p className="settings-message">{message}</p>}
          </div>
        )}

        {section === 'personal' && (
          <div className="settings-detail">
            {field('رقم الهاتف', phone, setPhone, 'رقم الهاتف')}
            <label className="settings-field"><span>البريد الإلكتروني</span><input value={user.email || ''} disabled /></label>
            <div className="settings-info">هذه المعلومات تستخدم للحساب وتسجيل الدخول، ولا تظهر للناس كرقم هاتف أو بريد إلا إذا أضفت ميزة مشاركة المعلومات لاحقاً.</div>
            <button className="settings-save" type="button" onClick={() => void save()} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ المعلومات'}</button>
            {message && <p className="settings-message">{message}</p>}
          </div>
        )}

        {section === 'security' && <div className="settings-detail settings-options"><button type="button"><span>🔑<strong>تغيير كلمة المرور</strong><small>تحديث كلمة المرور الخاصة بالحساب</small></span><b>›</b></button><button type="button"><span>📱<strong>الأجهزة التي سجلت الدخول منها</strong><small>راجع جلسات تسجيل الدخول</small></span><b>›</b></button><button type="button"><span>✓<strong>المصادقة الثنائية</strong><small>إضافة طبقة حماية إضافية</small></span><b>›</b></button></div>}

        {section === 'privacy' && <div className="settings-detail settings-options"><button type="button"><span>🔒<strong>الحساب الخاص</strong><small>تحكم بمن يستطيع رؤية منشوراتك</small></span><b>›</b></button><button type="button"><span>💬<strong>الرسائل والردود</strong><small>تحكم بمن يستطيع مراسلتك</small></span><b>›</b></button><button type="button"><span>🚫<strong>الحسابات المحظورة</strong><small>إدارة الحسابات التي حظرتها</small></span><b>›</b></button></div>}

        {section === 'notifications' && <div className="settings-detail settings-options"><button type="button"><span>❤️<strong>الإعجابات والتعليقات</strong><small>تنبيهات التفاعل على منشوراتك</small></span><b>›</b></button><button type="button"><span>👥<strong>المتابعون</strong><small>تنبيهات المتابعة والطلبات</small></span><b>›</b></button><button type="button"><span>✉️<strong>الرسائل</strong><small>تنبيهات الرسائل الجديدة</small></span><b>›</b></button></div>}

        {section === 'linked' && <div className="settings-detail settings-options"><button type="button"><span>🔗<strong>الحسابات المرتبطة</strong><small>إدارة الحسابات التي تربطها بمنصتك</small></span><b>›</b></button><div className="settings-info">هذا القسم مجهز للربط مستقبلاً. حالياً حسابك يعمل بشكل مستقل.</div></div>}

        {section === 'activity' && <div className="settings-detail settings-options"><button type="button" onClick={() => navigate('/saved')}><span>🔖<strong>المحفوظات</strong><small>المنشورات التي حفظتها</small></span><b>›</b></button><button type="button" onClick={() => navigate('/profile')}><span>📷<strong>منشوراتك</strong><small>إدارة المنشورات الموجودة في حسابك</small></span><b>›</b></button><button type="button" onClick={() => navigate('/stories')}><span>⭕<strong>القصص</strong><small>عرض القصص الفعالة حالياً</small></span><b>›</b></button></div>}
      </section>
    </main>
  );
}
