import React from "react";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

/** Apply light/dark from the OS only — no manual buttons. */
export function applySystemTheme() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  let dark = false;
  try {
    dark = window.matchMedia(MEDIA_QUERY).matches;
  } catch {}
  const theme = dark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = "auto";
  document.documentElement.style.colorScheme = theme;

  try {
    // Drop any old manual preference so the app always tracks the device.
    window.localStorage.removeItem("dj-theme");
  } catch {}

  const color = dark ? "#0b0d10" : "#f6f7f9";
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    document.head.appendChild(meta);
  } else {
    metas.forEach((m) => {
      m.content = color;
    });
  }
}

/** Invisible component: keeps data-theme in sync with the device. */
export function ThemeSync() {
  React.useEffect(() => {
    applySystemTheme();
    const media = window.matchMedia(MEDIA_QUERY);
    const onChange = () => applySystemTheme();
    try {
      if (typeof media.addEventListener === "function") media.addEventListener("change", onChange);
      else media.addListener(onChange);
      return () => {
        if (typeof media.removeEventListener === "function") media.removeEventListener("change", onChange);
        else media.removeListener(onChange);
      };
    } catch {
      return undefined;
    }
  }, []);
  return null;
}

/** @deprecated No UI toggle — theme follows the device. Kept so old imports do not break. */
export function ThemeToggle() {
  return null;
}

export function useTheme(): ["auto", () => void, "light" | "dark"] {
  const [resolved, setResolved] = React.useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    try {
      return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  React.useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY);
    const sync = () => {
      applySystemTheme();
      setResolved(media.matches ? "dark" : "light");
    };
    sync();
    try {
      if (typeof media.addEventListener === "function") media.addEventListener("change", sync);
      else media.addListener(sync);
      return () => {
        if (typeof media.removeEventListener === "function") media.removeEventListener("change", sync);
        else media.removeListener(sync);
      };
    } catch {
      return undefined;
    }
  }, []);

  return ["auto", () => {}, resolved];
}
