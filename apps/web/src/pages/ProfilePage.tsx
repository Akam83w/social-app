import { useNavigate } from 'react-router-dom';
import { avatar } from "../data/stories";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, accounts, logout, switchAccount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddAccount = () => {
    navigate('/login');
  };

  return (
    <main className="feed-container">
      <section className="stories-card">
        <div className="profile-row" style={{ padding: 25 }}>
          <img
            src={avatar}
            alt={user?.displayName || user?.username || "مستخدم"}
            style={{
              width: 90,
              height: 90,
              borderRadius: "50%",
            }}
          />

          <div>
            <h1>{user?.displayName || user?.username || "زائر"}</h1>
            <span>@{user?.username || "غير مسجل"}</span>
          </div>
        </div>

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
                  background: acc.user.id === user?.id ? "#eee" : "transparent",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                }}
              >
                @{acc.user.username} {acc.user.id === user?.id && "✓"}
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: "0 25px 25px", display: "flex", gap: 10 }}>
          <button onClick={handleAddAccount} style={{ flex: 1, padding: 10 }}>
            إضافة حساب
          </button>
          <button onClick={handleLogout} style={{ flex: 1, padding: 10 }}>
            تسجيل خروج
          </button>
        </div>
      </section>
    </main>
  );
}
