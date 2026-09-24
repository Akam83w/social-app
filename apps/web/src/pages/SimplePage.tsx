import type { ReactNode } from "react";

type SimplePageProps = {
  title: string;
  description: string;
  icon: ReactNode;
};

export default function SimplePage({
  title,
  description,
  icon,
}: SimplePageProps) {
  return (
    <main className="feed-container">
      <section
        className="stories-card"
        style={{ minHeight: 420, display: "grid", placeItems: "center" }}
      >
        <div style={{ textAlign: "center", padding: 30 }}>
          <div style={{ marginBottom: 20 }}>{icon}</div>
          <h1>{title}</h1>
          <p style={{ color: "#777", marginTop: 10 }}>{description}</p>
        </div>
      </section>
    </main>
  );
}
