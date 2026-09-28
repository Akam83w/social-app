import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, API_URL } from "../lib/api";
import { useAuth } from '../context/AuthContext';


export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suspendedToken, setSuspendedToken] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [appealSent, setAppealSent] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser({ identifier, password });
      if (data.user?.moderationStatus === 'suspended') {
        setSuspendedToken(data.token);
        setError('هذا الحساب موقوف بسبب مخالفات المحتوى. يمكنك تقديم استئناف.');
        return;
      }
      login(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        setError('البيانات غلط، حاول مرة ثانية');
      } else {
        setError('حدث خطأ، حاول مرة ثانية');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h2>تسجيل الدخول</h2>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            name="identifier"
            placeholder="الإيميل أو اسم المستخدم أو رقم الهاتف"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            name="password"
            placeholder="الباسورد"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      {suspendedToken && <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 10 }}>
        <strong>طلب استئناف</strong>
        <textarea value={appealReason} onChange={e=>setAppealReason(e.target.value)} placeholder="اكتب سبب طلب الاستئناف..." maxLength={2000} style={{ width:'100%', minHeight:100, marginTop:8 }} />
        <button type="button" disabled={!appealReason.trim() || appealSent} onClick={async()=>{try{const r=await fetch(API_URL+'/moderation/appeal',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+suspendedToken},body:JSON.stringify({reason:appealReason.trim()})});if(!r.ok)throw new Error();setAppealSent(true);}catch{setError('تعذر إرسال الاستئناف. حاول مرة ثانية.')}}} style={{ width:'100%', padding:10, marginTop:8 }}>{appealSent?'تم إرسال الاستئناف':'إرسال الاستئناف'}</button>
      </div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'جاري الدخول...' : 'دخول'}
        </button>
      </form>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate('/register')}
          style={{ width: '100%', padding: 10 }}
        >
          إنشاء حساب جديد
        </button>

        <button
          type="button"
          onClick={() => navigate('/forgot-password')}
          style={{ width: '100%', padding: 10 }}
        >
          نسيت كلمة المرور؟
        </button>
      </div>
    </div>
  );
}
