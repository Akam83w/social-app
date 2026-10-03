import OptimizedImage from "../components/OptimizedImage";
import { API_URL, getLinkedSocialAccounts, startSocialLogin, unlinkSocialAccount } from "../lib/api";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type EditableUser = { bio?: string | null; phone?: string | null; isPrivate?: boolean };

type Section = 'home' | 'edit' | 'personal' | 'privacy' | 'notifications' | 'linked' | 'activity';
type Detail = 'privateAccount' | 'messagePrivacy' | 'blocked' | 'likesComments' | 'followers' | 'messageNotifications' | null;

const rows: Array<{ id: Exclude<Section, 'home'>; title: string; description: string; icon: string }> = [
  { id: 'edit', title: 'تعديل الملف الشخصي', description: 'الاسم، اسم المستخدم، النبذة والصورة الشخصية', icon: '👤' },
  { id: 'personal', title: 'المعلومات الشخصية', description: 'رقم الهاتف والبريد الإلكتروني', icon: '🪪' },
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
  const [blockedUsers, setBlockedUsers] = useState<Array<{id:string;username:string;displayName:string|null;avatarUrl:string|null;createdAt:string}>>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<Array<{provider:string;providerEmail?:string|null}>>([]);
  const [linkedLoading, setLinkedLoading] = useState(false);

  const loadLinkedAccounts = async () => {
    if (!token) return;
    setLinkedLoading(true);
    try {
      const data = await getLinkedSocialAccounts(token);
      setLinkedProviders(data.identities ?? []);
    } catch {
      setLinkedProviders([]);
      setMessage('تعذر تحميل الحسابات المرتبطة.');
    } finally {
      setLinkedLoading(false);
    }
  };

  const isLinked = (provider: string) => linkedProviders.some(item => item.provider === provider);

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

  const loadBlockedUsers = async () => {
    if (!token) return;
    setBlockedLoading(true);
    try {
      const r = await fetch(API_URL + '/auth/blocked', { headers: { Authorization: 'Bearer ' + token } });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setBlockedUsers(d.users ?? []);
    } catch {
      setBlockedUsers([]);
      setMessage('تعذر تحميل الحسابات المحظورة.');
    } finally {
      setBlockedLoading(false);
    }
  };

  const unblockUser = async (username: string) => {
    if (!token) return;
    try {
      const r = await fetch(API_URL + '/auth/users/' + encodeURIComponent(username) + '/block', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) throw new Error();
      setBlockedUsers(prev => prev.filter(item => item.username !== username));
      setMessage('تم إلغاء الحظر.');
    } catch {
      setMessage('تعذر إلغاء الحظر.');
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

  const go = (id: Section) => { setMessage(''); setDetail(null); setSection(id); if (id === 'linked') void loadLinkedAccounts(); };
  const openDetail = (id: Exclude<Detail, null>) => { setMessage(''); setDetail(id); if (id === 'blocked') void loadBlockedUsers(); };

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
          <div><h1>{detail ? ({privateAccount:'الحساب الخاص',messagePrivacy:'الرسائل والردود',blocked:'الحسابات المحظورة',likesComments:'الإعجابات والتعليقات',followers:'المتابعون',messageNotifications:'إشعارات الرسائل'} as Record<Exclude<Detail,null>,string>)[detail] : section === 'home' ? 'الإعدادات' : rows.find(r => r.id === section)?.title}</h1><small>{detail ? 'إعدادات الحساب' : section === 'home' ? 'إدارة حسابك وتجربتك' : 'إعدادات الحساب'}</small></div>
        </header>

        {section === 'home' && (
          <>
            <div className="settings-profile-card">
              <OptimizedImage src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`} alt="" />
              <div><strong>{user.displayName || user.username}</strong><span>@{user.username}</span></div>
              <button type="button" onClick={() => go('edit')}>تعديل</button>
            </div>

            <div className="settings-group">
              <h2>الحساب</h2>
              {rows.slice(0, 2).map(r => <button className="settings-row" type="button" key={r.id} onClick={() => go(r.id)}><b className="settings-icon">{r.icon}</b><span><strong>{r.title}</strong><small>{r.description}</small></span><b>›</b></button>)}
            </div>

            <div className="settings-group">
              <h2>الخصوصية</h2>
              {rows.slice(2, 4).map(r => <button className="settings-row" type="button" key={r.id} onClick={() => go(r.id)}><b className="settings-icon">{r.icon}</b><span><strong>{r.title}</strong><small>{r.description}</small></span><b>›</b></button>)}
            </div>

            <div className="settings-group">
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
              <OptimizedImage src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`} alt="" />
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

                {section === 'privacy' && !detail && <div className="settings-detail settings-options"><button type="button" onClick={() => openDetail('privateAccount')}><span>🔒<strong>الحساب الخاص</strong><small>تحكم بمن يستطيع رؤية منشوراتك</small></span><b>›</b></button><button type="button" onClick={() => openDetail('messagePrivacy')}><span>💬<strong>الرسائل والردود</strong><small>تحكم بمن يستطيع مراسلتك</small></span><b>›</b></button><button type="button" onClick={() => openDetail('blocked')}><span>🚫<strong>الحسابات المحظورة</strong><small>إدارة الحسابات التي حظرتها</small></span><b>›</b></button></div>}

        {section === 'notifications' && !detail && <div className="settings-detail settings-options"><button type="button" onClick={() => openDetail('likesComments')}><span>❤️<strong>الإعجابات والتعليقات</strong><small>تنبيهات التفاعل على منشوراتك</small></span><b>›</b></button><button type="button" onClick={() => openDetail('followers')}><span>👥<strong>المتابعون</strong><small>تنبيهات المتابعة والطلبات</small></span><b>›</b></button><button type="button" onClick={() => openDetail('messageNotifications')}><span>✉️<strong>الرسائل</strong><small>تنبيهات الرسائل الجديدة</small></span><b>›</b></button></div>}

        {section === 'linked' && !detail && <div className="settings-detail settings-options">
          <div className="settings-info">اربط فيسبوك و X بحساب دجلة حتى تقدر تدخل إلى نفس الحساب بنقرة واحدة. البريد الإلكتروني هو وسيلة الحساب الأساسية.</div>
          <div className="settings-switch-row"><div><strong>✉️ البريد الإلكتروني</strong><small>{user.email || 'غير متوفر'} · مرتبط بالحساب</small></div><b className="settings-linked-badge">مرتبط</b></div>
          <div className="settings-switch-row"><div><strong>𝕏 X / تويتر</strong><small>{isLinked('twitter') ? 'مرتبط ويمكن استخدامه لتسجيل الدخول.' : 'غير مرتبط حالياً.'}</small></div>{isLinked('twitter') ? <button type="button" className="settings-link-button danger" onClick={async()=>{if(!token)return;try{await unlinkSocialAccount(token,'twitter');setLinkedProviders(v=>v.filter(x=>x.provider!=='twitter'));setMessage('تم فصل X عن الحساب.');}catch{setMessage('تعذر فصل X.');}}}>فصل</button> : <button type="button" className="settings-link-button" onClick={()=>{try{startSocialLogin('twitter','link')}catch(err:any){setMessage(err?.message==='SOCIAL_LOGIN_NOT_CONFIGURED'?'ربط X يحتاج مفتاح Supabase العام في إعدادات Deplexo.':'تعذر بدء ربط X.');}}}>ربط</button>}</div>
          <div className="settings-switch-row"><div><strong>ⓕ فيسبوك</strong><small>{isLinked('facebook') ? 'مرتبط ويمكن استخدامه لتسجيل الدخول.' : 'غير مرتبط حالياً.'}</small></div>{isLinked('facebook') ? <button type="button" className="settings-link-button danger" onClick={async()=>{if(!token)return;try{await unlinkSocialAccount(token,'facebook');setLinkedProviders(v=>v.filter(x=>x.provider!=='facebook'));setMessage('تم فصل فيسبوك عن الحساب.');}catch{setMessage('تعذر فصل فيسبوك.');}}}>فصل</button> : <button type="button" className="settings-link-button" onClick={()=>{try{startSocialLogin('facebook','link')}catch(err:any){setMessage(err?.message==='SOCIAL_LOGIN_NOT_CONFIGURED'?'ربط فيسبوك يحتاج مفتاح Supabase العام في إعدادات Deplexo.':'تعذر بدء ربط فيسبوك.');}}}>ربط</button>}</div>
          {linkedLoading && <p className="settings-info">جاري تحميل حالة الربط...</p>}
          {message && <p className="settings-message">{message}</p>}
        </div>}

        {section === 'activity' && !detail && <div className="settings-detail settings-options"><button type="button" onClick={() => navigate('/saved')}><span>🔖<strong>المحفوظات</strong><small>المنشورات التي حفظتها</small></span><b>›</b></button><button type="button" onClick={() => navigate('/profile')}><span>📷<strong>منشوراتك</strong><small>إدارة المنشورات الموجودة في حسابك</small></span><b>›</b></button><button type="button" onClick={() => navigate('/stories')}><span>⭕<strong>القصص</strong><small>عرض القصص الفعالة حالياً</small></span><b>›</b></button></div>}
        {detail && <div className="settings-detail settings-subdetail">
          {detail === 'privateAccount' && <><div className="settings-switch-row"><div><strong>الحساب الخاص</strong><small>السماح للمتابعين المقبولين فقط برؤية منشوراتك.</small></div><button type="button" className={privateAccount ? 'settings-switch on' : 'settings-switch'} onClick={async () => { if (!token) return; const next=!privateAccount; setPrivateAccount(next); setMessage(''); try { const r=await fetch(API_URL+'/auth/privacy',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({isPrivate:next})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'تعذر حفظ الخصوصية'); login(d.user,token); setMessage('تم حفظ إعداد الخصوصية.'); } catch(e) { setPrivateAccount(!next); setMessage(e instanceof Error?e.message:'تعذر حفظ إعداد الخصوصية'); } }} aria-pressed={privateAccount}><span /></button></div><div className="settings-info">الحساب الخاص يمنع غير المتابعين المقبولين من رؤية منشوراتك وقوائم المتابعين والمتابَعين.</div>{message&&<p className="settings-message">{message}</p>}</>}
          {detail === 'messagePrivacy' && <div className="settings-options"><button type="button"><span>💬<strong>من يستطيع مراسلتي</strong><small>حالياً: المستخدمون القادرون على بدء محادثة</small></span><b>›</b></button><div className="settings-info">خيارات قبول الرسائل تحتاج ربطاً بسياسة رسائل في الخادم.</div></div>}
          {detail === 'blocked' && <div className="settings-detail">
            {blockedLoading ? <p className="settings-info">جاري تحميل الحسابات المحظورة...</p> : blockedUsers.length === 0 ? <p className="settings-info">ماكو حسابات محظورة حالياً.</p> : <div className="settings-options">{blockedUsers.map(item => <div key={item.id} className="settings-switch-row"><div style={{display:'flex',alignItems:'center',gap:10}}><OptimizedImage src={item.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}`} alt="" style={{width:42,height:42,borderRadius:'50%',objectFit:'cover'}}/><span><strong>{item.displayName || item.username}</strong><small>@{item.username}</small></span></div><button type="button" className="settings-save" onClick={() => void unblockUser(item.username)}>إلغاء الحظر</button></div>)}</div>}
            {!blockedLoading && <button type="button" className="settings-save" onClick={() => void loadBlockedUsers()}>تحديث القائمة</button>}
          </div>}
          {detail === 'likesComments' && <div className="settings-switch-row"><div><strong>الإعجابات والتعليقات</strong><small>إظهار تنبيهات الإعجاب والتعليق.</small></div><button type="button" className={likesComments ? 'settings-switch on' : 'settings-switch'} onClick={() => setLikesComments(v => !v)} aria-pressed={likesComments}><span /></button></div>}
          {detail === 'followers' && <div className="settings-detail">
            <div className="settings-switch-row"><div><strong>المتابعون</strong><small>إظهار تنبيهات المتابعة وطلبات المتابعة.</small></div><button type="button" className={followers ? 'settings-switch on' : 'settings-switch'} onClick={() => setFollowers(v => !v)} aria-pressed={followers}><span /></button></div>
            <div className="settings-info">طلبات المتابعة المعلقة</div>
            <button type="button" className="settings-save" onClick={() => void loadFollowRequests()} disabled={followRequestsLoading}>{followRequestsLoading ? 'جارٍ التحميل...' : 'تحديث الطلبات'}</button>
            {followRequests.length === 0 ? <p className="settings-info">ماكو طلبات متابعة معلقة حالياً.</p> : <div className="settings-options">{followRequests.map(req => <div key={req.id} className="settings-switch-row"><div><strong>{req.displayName || req.username}</strong><small>@{req.username}</small></div><div><button type="button" className="settings-save" onClick={() => void handleFollowRequest(req.username, 'accept')}>قبول</button><button type="button" className="settings-save" onClick={() => void handleFollowRequest(req.username, 'reject')}>رفض</button></div></div>)}</div>}
          </div>}
          {detail === 'messageNotifications' && <div className="settings-switch-row"><div><strong>إشعارات الرسائل</strong><small>إظهار تنبيهات الرسائل الجديدة.</small></div><button type="button" className={messageNotifications ? 'settings-switch on' : 'settings-switch'} onClick={() => setMessageNotifications(v => !v)} aria-pressed={messageNotifications}><span /></button></div>}
        </div>}
      </section>
    </main>
  );
}
