import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser({ identifier, password });
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
