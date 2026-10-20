import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import OptimizedImage from "../components/OptimizedImage";
import VideoPlayer from "../components/VideoPlayer";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Story = {
  id: string;
  media_url: string;
  media_type: string;
  media_poster?: string | null;
  content: string | null;
  created_at: string;
  expires_at: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function StoriesPage() {
  const { username } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    apiRequest("/stories", token)
      .then((data) => {
        if (active) setStories(data.stories ?? []);
      })
      .catch(() => {
        if (active) setError("تعذر تحميل القصص.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const mine = useMemo(() => {
    if (!username) return [];
    const name = decodeURIComponent(username).toLowerCase();
    return stories.filter((story) => story.username.toLowerCase() === name).slice().reverse();
  }, [stories, username]);

  useEffect(() => {
    setIndex(0);
  }, [username]);

  useEffect(() => {
    if (!username || !mine.length) return;
    const current = mine[index];
    if (!current || current.media_type === "video") return;
    const timer = window.setTimeout(() => {
      if (index < mine.length - 1) setIndex((value) => value + 1);
      else navigate("/stories");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [username, mine, index, navigate]);

  if (!username) {
    const people = Array.from(new Map(stories.map((story) => [story.user_id, story])).values());
    return (
      <main className="feed-container">
        <section className="stories-card">
          <div className="section-heading">
            <h2>القصص</h2>
            <Link to="/create-story">إنشاء قصة</Link>
          </div>
          {loading && <p>جاري تحميل القصص...</p>}
          {error && <p className="search-error">{error}</p>}
          {!loading && !error && people.length === 0 && (
            <div className="reels-empty">ماكو قصص منشورة حالياً. انشر أول قصة من حسابك.</div>
          )}
          <div className="stories-row">
            {people.map((story) => (
              <Link to={`/stories/${encodeURIComponent(story.username)}`} className="story" key={story.user_id}>
                <div className="story-ring">
                  <div className="story-image">
                    <OptimizedImage
                      src={story.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.username)}`}
                      alt=""
                    />
                  </div>
                </div>
                <span>{story.user_id === user?.id ? "قصتك" : story.display_name || story.username}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    );
  }

  const story = mine[index];
  return (
    <main className="story-stage" dir="rtl">
      <div className="story-stage-card">
        <header className="story-stage-top">
          <div className="story-progress">
            {mine.map((item, itemIndex) => (
              <span key={item.id}>
                <i className={itemIndex < index ? "done" : itemIndex === index && story?.media_type !== "video" ? "live" : itemIndex === index ? "done" : ""} />
              </span>
            ))}
          </div>
          <div className="story-stage-user">
            <OptimizedImage
              src={story?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`}
              alt=""
            />
            <div>
              <strong>{story?.display_name || story?.username || username}</strong>
              <small>
                {story
                  ? new Date(story.created_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
                  : ""}
              </small>
            </div>
            <Link to="/" className="story-close">إغلاق</Link>
          </div>
        </header>
        {loading && <p className="story-stage-empty">جاري تحميل القصة...</p>}
        {error && <p className="story-stage-empty">{error}</p>}
        {!loading && !error && !story && (
          <p className="story-stage-empty">
            ماكو قصة فعالة لهذا الحساب. <Link to="/create-story">انشر قصة</Link>
          </p>
        )}
        {story && (
          <div className="story-stage-media">
            {story.media_type === "video" ? (
              <VideoPlayer src={story.media_url} poster={story.media_poster} className="story-stage-video" controls autoPlay />
            ) : (
              <OptimizedImage src={story.media_url} alt={story.content || "قصة"} />
            )}
            {story.content && <p className="story-stage-caption">{story.content}</p>}
            <button type="button" className="story-nav prev" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
              السابق
            </button>
            <button
              type="button"
              className="story-nav next"
              onClick={() => {
                if (index < mine.length - 1) setIndex((value) => value + 1);
                else navigate("/stories");
              }}
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
