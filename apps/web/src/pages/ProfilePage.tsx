import { avatar } from "../data/stories";

export default function ProfilePage() {
  return (
    <main className="feed-container">
      <section className="stories-card">
        <div className="profile-row" style={{ padding: 25 }}>
          <img
            src={avatar}
            alt="ذنون"
            style={{
              width: 90,
              height: 90,
              borderRadius: "50%",
            }}
          />

          <div>
            <h1>ذنون</h1>
            <span>@dhnoun</span>
          </div>
        </div>

        <div style={{ padding: "0 25px 25px" }}>
          <p>حسابي على إنستعراق 🇮🇶</p>
          <p style={{ color: "#777" }}>
            0 منشور · 0 متابع · 0 يتابع
          </p>
        </div>
      </section>
    </main>
  );
}
