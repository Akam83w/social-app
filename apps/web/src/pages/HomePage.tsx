import { useState } from "react";
import { Link } from "react-router-dom";
import {
  PlusIcon,
  HeartIcon,
  CommentIcon,
  SendIcon,
  BookmarkIcon,
  MoreIcon,
} from "../components/icons/Icons";
import { posts } from "../data/posts";
import { stories } from "../data/stories";

export default function HomePage() {
  const [likedPosts, setLikedPosts] = useState<number[]>([]);
  const [savedPosts, setSavedPosts] = useState<number[]>([]);

  const toggleLike = (id: number) => {
    setLikedPosts((current) =>
      current.includes(id)
        ? current.filter((postId) => postId !== id)
        : [...current, id],
    );
  };

  const toggleSave = (id: number) => {
    setSavedPosts((current) =>
      current.includes(id)
        ? current.filter((postId) => postId !== id)
        : [...current, id],
    );
  };

  return (
    <main className="feed-container">
      <section className="stories-card">
        <div className="section-heading">
          <h2>القصص</h2>
          <Link to="/stories">مشاهدة الكل</Link>
        </div>

        <div className="stories-row">
          {stories.map((story) => (
            <Link
              to={story.own ? "/create" : `/stories/${story.name}`}
              className="story"
              key={story.name}
            >
              <div className={`story-ring ${story.own ? "own" : ""}`}>
                <div className="story-image">
                  <img src={story.image} alt={story.name} />
                </div>

                {story.own && (
                  <span className="story-plus">
                    <PlusIcon size={12} strokeWidth={2.5} />
                  </span>
                )}
              </div>

              <span>{story.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="feed-heading">
        <div>
          <p>أحدث المنشورات</p>
          <h1>لك اليوم</h1>
        </div>

        <button className="filter-button">لك ▾</button>
      </div>

      <section className="posts">
        {posts.map((post) => {
          const liked = likedPosts.includes(post.id);
          const saved = savedPosts.includes(post.id);

          return (
            <article className="post-card" key={post.id}>
              <header className="post-header">
                <Link to={`/u/${encodeURIComponent(post.username)}`} className="post-user">
                  <img src={post.avatar} alt={post.username} />

                  <div>
                    <strong>{post.username}</strong>
                    <span>{post.location}</span>
                  </div>
                </Link>

                <button className="more-button">
                  <MoreIcon />
                </button>
              </header>

              <Link to={`/post/${post.id}`} className="post-media">
                <img src={post.image} alt={post.caption} />
              </Link>

              <div className="post-actions">
                <div className="actions-left">
                  <button
                    className={liked ? "action liked" : "action"}
                    onClick={() => toggleLike(post.id)}
                  >
                    <HeartIcon filled={liked} />
                  </button>

                  <Link to={`/post/${post.id}#comments`} className="action">
                    <CommentIcon />
                  </Link>

                  <button
                    className="action"
                    onClick={() => {
                      const url = `${window.location.origin}/post/${post.id}`;
                      navigator.clipboard?.writeText(url);
                    }}
                  >
                    <SendIcon />
                  </button>
                </div>

                <button
                  className={saved ? "action saved" : "action"}
                  onClick={() => toggleSave(post.id)}
                >
                  <BookmarkIcon />
                </button>
              </div>

              <div className="post-content">
                <strong>
                  {(liked ? post.likes + 1 : post.likes).toLocaleString(
                    "ar-IQ",
                  )}{" "}
                  إعجاب
                </strong>

                <p>
                  <Link to={`/u/${encodeURIComponent(post.username)}`}>
                    <b>{post.username}</b>
                  </Link>{" "}
                  {post.caption}
                </p>

                <Link
                  to={`/post/${post.id}#comments`}
                  className="comments-link"
                >
                  عرض كل التعليقات ({post.comments})
                </Link>

                <time>{post.time}</time>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
