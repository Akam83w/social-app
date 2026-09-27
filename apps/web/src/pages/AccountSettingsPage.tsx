import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type EditableUser = { bio?: string | null; phone?: string | null; isPrivate?: boolean };

type Section = 'home' | 'edit' | 'personal' | 'security' | 'privacy' | 'notifications' | 'linked' | 'activity';
type Detail = 'password' | 'sessions' | 'twoFactor' | 'privateAccount' | 'messagePrivacy' | 'blocked' | 'likesComments' | 'followers' | 'messageNotifications' | 'linkedAccounts' | null;

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
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const editableUser = user as (typeof user & EditableUser);
  const [section, setSection] = useState<Section>('home');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState(editableUser?.phone || '');
  const [bio, setBio] = useState(editableUser?.bio || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Detail>(null);
  const [privateAccount, setPrivateAccount] = useState(Boolean(editableUser?.isPrivate));
  const [likesComments, setLikesComments] = useState(true);
  const [followers, setFollowers] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [followRequests, setFollowRequests] = useState<Array<{id:string;username:string;displayName:string|null;avatarUrl:string|null;createdAt:string}>>([]);
  const [followRequestsLoading, setFollowRequestsLoading] = useState(false);

  const loadFollowRequests = async () => {
    if (!token) return;
    setFollowRequestsLoading(true);
    try {
      const r = await fetch(API_URL + '/auth/follow-requests', { headers: { Authorization: 'Bearer ' + token } });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setFollowRequests(d.requests ?? []);
    } catch {
      setFollowRequests([]);
    } finally {
      setFollowRequestsLoading(false);
    }
  };

  const handleFollowRequest = async (username: string, action: 'accept' | 'reject') => {
    if (!token) return;
    try {
      const r = await fetch(API_URL + '/auth/users/' + encodeURIComponent(username) + '/follow/' + action, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) throw new Error();
      setFollowRequests(prev => prev.filter(item => item.username !== username));
    } catch {
      setMessage('تعذر تحديث طلب المتابعة.');
    }
  };

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

  const go = (id: Section) => { setMessage(''); setDetail(null); setSection(id); };
  const openDetail = (id: Exclude<Detail, null>) => { setMessage(''); setDetail(id); };

  const back = () => {
    if (detail) { setDetail(null); return; }
    if (section === 'home') navigate('/profile'); else setSection('home');
  };

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
          <div><h1>{detail ? ({password:'تغيير كلمة المرور',sessions:'الأجهزة المسجل دخولها',twoFactor:'المصادقة الثنائية',privateAccount:'الحساب الخاص',messagePrivacy:'الرسائل والردود',blocked:'الحسابات المحظورة',likesComments:'الإعجابات والتعليقات',followers:'المتابعون',messageNotifications:'إشعارات الرسائل',linkedAccounts:'الحسابات المرتبطة'} as Record<Exclude<Detail,null>,string>)[detail] : section === 'home' ? 'الإعدادات' : rows.find(r => r.id === section)?.title}</h1><small>{detail ? 'إعدادات الحساب' : section === 'home' ? 'إدارة حسابك وتجربتك' : 'إعدادات الحساب'}</small></div>
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
              <button className="settings-row" type="button" onClick={() => navigate('/login')}><b className="settings-icon">➕</b><span><strong>إضافة حساب</strong><small>تسجيل الدخول إلى حساب آخر</small></span><b>›</b></button>
              <button className="settings-row danger" type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }}><b className="settings-icon">↪</b><span><strong>تسجيل خروج</strong><small>الخروج من هذا الحساب</small></span><b>›</b></button>
              <button className="settings-row" type="button" onClick={() => navigate('/profile')}><b className="settings-icon">↩</b><span><strong>العودة إلى الحساب</strong><small>إغلاق الإعدادات</small></span><b>›</b></button>
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

        {section === 'security' && !detail && <div className="settings-detail settings-options"><button type="button" onClick={() => openDetail('password')}><span>🔑<strong>تغيير كلمة المرور</strong><small>تحديث كلمة المرور الخاصة بالحساب</small></span><b>›</b></button><button type="button" onClick={() => openDetail('sessions')}><span>📱<strong>الأجهزة التي سجلت الدخول منها</strong><small>راجع جلسات تسجيل الدخول</small></span><b>›</b></button><button type="button" onClick={() => openDetail('twoFactor')}><span>✓<strong>المصادقة الثنائية</strong><small>إضافة طبقة حماية إضافية</small></span><b>›</b></button></div>}

        {section === 'privacy' && !detail && <div className="settings-detail settings-options"><button type="button" onClick={() => openDetail('privateAccount')}><span>🔒<strong>الحساب الخاص</strong><small>تحكم بمن يستطيع رؤية منشوراتك</small></span><b>›</b></button><button type="button" onClick={() => openDetail('messagePrivacy')}><span>💬<strong>الرسائل والردود</strong><small>تحكم بمن يستطيع مراسلتك</small></span><b>›</b></button><button type="button" onClick={() => openDetail('blocked')}><span>🚫<strong>الحسابات المحظورة</strong><small>إدارة الحسابات التي حظرتها</small></span><b>›</b></button></div>}

        {section === 'notifications' && !detail && <div className="settings-detail settings-options"><button type="button" onClick={() => openDetail('likesComments')}><span>❤️<strong>الإعجابات والتعليقات</strong><small>تنبيهات التفاعل على منشوراتك</small></span><b>›</b></button><button type="button" onClick={() => openDetail('followers')}><span>👥<strong>المتابعون</strong><small>تنبيهات المتابعة والطلبات</small></span><b>›</b></button><button type="button" onClick={() => openDetail('messageNotifications')}><span>✉️<strong>الرسائل</strong><small>تنبيهات الرسائل الجديدة</small></span><b>›</b></button></div>}

        {section === 'linked' && !detail && <div className="settings-detail settings-options"><button type="button" onClick={() => openDetail('linkedAccounts')}><span>🔗<strong>الحسابات المرتبطة</strong><small>إدارة الحسابات التي تربطها بمنصتك</small></span><b>›</b></button><div className="settings-info">هذا القسم مجهز للربط مستقبلاً. حالياً حسابك يعمل بشكل مستقل.</div></div>}

        {section === 'activity' && !detail && <div className="settings-detail settings-options"><button type="button" onClick={() => navigate('/saved')}><span>🔖<strong>المحفوظات</strong><small>المنشورات التي حفظتها</small></span><b>›</b></button><button type="button" onClick={() => navigate('/profile')}><span>📷<strong>منشوراتك</strong><small>إدارة المنشورات الموجودة في حسابك</small></span><b>›</b></button><button type="button" onClick={() => navigate('/stories')}><span>⭕<strong>القصص</strong><small>عرض القصص الفعالة حالياً</small></span><b>›</b></button></div>}
        {detail && <div className="settings-detail settings-subdetail">
          {detail === 'password' && <><div className="settings-info">تغيير كلمة المرور يحتاج نقطة API مخصصة في الخادم. حالياً ما راح أوهمك بأن الزر يغيّر كلمة السر وهو ما عنده مسار خلفي.</div><button className="settings-save" type="button" onClick={() => navigate('/login')}>الانتقال إلى تسجيل الدخول</button></>}
          {detail === 'sessions' && <div className="settings-info">إدارة جلسات الأجهزة تحتاج تخزين جلسات الدخول في الخادم. هذه الصفحة أصبحت قابلة للفتح، لكن قائمة الأجهزة غير مفعلة بعد.</div>}
          {detail === 'twoFactor' && <div className="settings-info">المصادقة الثنائية تحتاج إعدادات خادم ومفاتيح تحقق قبل تفعيلها بشكل آمن. الواجهة جاهزة للتوسع لاحقاً.</div>}
          {detail === 'privateAccount' && <><div className="settings-switch-row"><div><strong>الحساب الخاص</strong><small>السماح للمتابعين المقبولين فقط برؤية منشوراتك.</small></div><button type="button" className={privateAccount ? 'settings-switch on' : 'settings-switch'} onClick={async () => { if (!token) return; const next=!privateAccount; setPrivateAccount(next); setMessage(''); try { const r=await fetch(API_URL+'/auth/privacy',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({isPrivate:next})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'تعذر حفظ الخصوصية'); login(d.user,token); setMessage('تم حفظ إعداد الخصوصية.'); } catch(e) { setPrivateAccount(!next); setMessage(e instanceof Error?e.message:'تعذر حفظ إعداد الخصوصية'); } }} aria-pressed={privateAccount}><span /></button></div><div className="settings-info">الحساب الخاص يمنع غير المتابعين المقبولين من رؤية منشوراتك وقوائم المتابعين والمتابَعين.</div>{message&&<p className="settings-message">{message}</p>}</>}
          {detail === 'messagePrivacy' && <div className="settings-options"><button type="button"><span>💬<strong>من يستطيع مراسلتي</strong><small>حالياً: المستخدمون القادرون على بدء محادثة</small></span><b>›</b></button><div className="settings-info">خيارات قبول الرسائل تحتاج ربطاً بسياسة رسائل في الخادم.</div></div>}
          {detail === 'blocked' && <div className="settings-info">لا توجد قائمة حظر مرتبطة بهذا القسم حالياً. عند إضافة الحظر من الخادم ستظهر الحسابات هنا.</div>}
          {detail === 'likesComments' && <div className="settings-switch-row"><div><strong>الإعجابات والتعليقات</strong><small>إظهار تنبيهات الإعجاب والتعليق.</small></div><button type="button" className={likesComments ? 'settings-switch on' : 'settings-switch'} onClick={() => setLikesComments(v => !v)} aria-pressed={likesComments}><span /></button></div>}
          {detail === 'followers' && <div className="settings-detail">
            <div className="settings-switch-row"><div><strong>المتابعون</strong><small>إظهار تنبيهات المتابعة وطلبات المتابعة.</small></div><button type="button" className={followers ? 'settings-switch on' : 'settings-switch'} onClick={() => setFollowers(v => !v)} aria-pressed={followers}><span /></button></div>
            <div className="settings-info">طلبات المتابعة المعلقة</div>
            <button type="button" className="settings-save" onClick={() => void loadFollowRequests()} disabled={followRequestsLoading}>{followRequestsLoading ? 'جارٍ التحميل...' : 'تحديث الطلبات'}</button>
            {followRequests.length === 0 ? <p className="settings-info">ماكو طلبات متابعة معلقة حالياً.</p> : <div className="settings-options">{followRequests.map(req => <div key={req.id} className="settings-switch-row"><div><strong>{req.displayName || req.username}</strong><small>@{req.username}</small></div><div><button type="button" className="settings-save" onClick={() => void handleFollowRequest(req.username, 'accept')}>قبول</button><button type="button" className="settings-save" onClick={() => void handleFollowRequest(req.username, 'reject')}>رفض</button></div></div>)}</div>}
          </div>}
          {detail === 'messageNotifications' && <div className="settings-switch-row"><div><strong>إشعارات الرسائل</strong><small>إظهار تنبيهات الرسائل الجديدة.</small></div><button type="button" className={messageNotifications ? 'settings-switch on' : 'settings-switch'} onClick={() => setMessageNotifications(v => !v)} aria-pressed={messageNotifications}><span /></button></div>}
          {detail === 'linkedAccounts' && <><div className="settings-info">لا يوجد ربط خارجي مفعّل لهذا الحساب حالياً.</div><button type="button" className="settings-save" onClick={() => setMessage('الحساب يعمل بشكل مستقل حالياً.')}>إدارة الحساب</button>{message && <p className="settings-message">{message}</p>}</>}
        </div>}
      </section>
    </main>
  );
}
