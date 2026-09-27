import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../lib/api';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{2,30}$/.test(normalizedUsername)) {
      setError('اسم المستخدم لازم يكون من حرفين إلى 30 حرف، ويحتوي فقط على a-z والأرقام و _ و .');
      return;
    }
    setLoading(true);
    try {
      await registerUser({ username: normalizedUsername, email, password });
      navigate('/login');
    } catch (err: any) {
      if (err.message === 'USER_ALREADY_EXISTS') {
        setError('هذا المستخدم أو الإيميل موجود مسبقاً');
      } else {
        setError('حدث خطأ، حاول مرة ثانية');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h2>حساب جديد</h2>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            name="username"
            placeholder="اسم المستخدم (مثلاً a_a أو 1_2)"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30))}
            required
            minLength={2}
            maxLength={30}
            pattern="[a-z0-9_.]{2,30}"
            autoComplete="username"
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            name="email"
            placeholder="الإيميل"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            name="password"
            placeholder="الباسورد (8 حروف على الأقل)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'جاري التسجيل...' : 'تسجيل'}
        </button>
      </form>
    </div>
  );
}
