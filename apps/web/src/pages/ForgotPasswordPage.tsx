import { API_URL } from "../lib/api";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';


export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetId, setResetId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'REQUEST_FAILED');
      }

      setMessage('إذا كان الإيميل مسجلاً، تم إرسال رمز الاستعادة.');
      setStep(2);
    } catch {
      setError('تعذر إرسال طلب الاستعادة، حاول مرة ثانية.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/password-reset/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        throw new Error('INVALID_CODE');
      }

      setResetId(data.resetId);
      setResetToken(data.resetToken);
      setStep(3);
    } catch {
      setError('رمز التحقق غير صحيح أو منتهي.');
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/password-reset/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetId,
          resetToken,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'RESET_FAILED');
      }

      setMessage('تم تغيير كلمة المرور بنجاح.');
      setTimeout(() => navigate('/login'), 800);
    } catch {
      setError('تعذر تغيير كلمة المرور.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h2>استعادة كلمة المرور</h2>

      {step === 1 && (
        <form onSubmit={requestCode}>
          <input
            type="email"
            placeholder="الإيميل"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 10, marginBottom: 12 }}
          />

          <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
            {loading ? 'جاري الإرسال...' : 'إرسال رمز الاستعادة'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyCode}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="رمز التحقق"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            style={{ width: '100%', padding: 10, marginBottom: 12 }}
          />

          <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
            {loading ? 'جاري التحقق...' : 'تحقق من الرمز'}
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={changePassword}>
          <input
            type="password"
            placeholder="كلمة المرور الجديدة"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            style={{ width: '100%', padding: 10, marginBottom: 12 }}
          />

          <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
            {loading ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
          </button>
        </form>
      )}

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button
        type="button"
        onClick={() => navigate('/login')}
        style={{ marginTop: 16, width: '100%', padding: 10 }}
      >
        العودة لتسجيل الدخول
      </button>
    </div>
  );
}
