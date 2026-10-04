import React from "react";

export type ThemeMode = "auto" | "light" | "dark";
const STORAGE_KEY = "dj-theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function readSavedMode(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return "auto";
}

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") {
    return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
  }
  return mode;
}

function applyTheme(mode: ThemeMode) {
  const theme = resolve(mode);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = mode;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#0b0d10" : "#f6f7f9";
}

export function useTheme(): [ThemeMode, () => void] {
  const [mode, setMode] = React.useState<ThemeMode>(readSavedMode);

  React.useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY);
    const apply = () => applyTheme(mode);

    apply();

    try {
      if (mode === "auto") {
        const onChange = () => applyTheme("auto");
        if (typeof media.addEventListener === "function") media.addEventListener("change", onChange);
        else media.addListener(onChange);
        return () => {
          if (typeof media.removeEventListener === "function") media.removeEventListener("change", onChange);
          else media.removeListener(onChange);
        };
      }
    } catch {}

    return undefined;
  }, [mode]);

  React.useEffect(() => {
    try {
      if (mode === "auto") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, [mode]);

  const cycle = React.useCallback(() => {
    setMode(current => current === "auto" ? "light" : current === "light" ? "dark" : "auto");
  }, []);

  return [mode, cycle];
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}

function AutoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18V3z"/><path d="M12 3a9 9 0 0 1 0 18" opacity=".32"/></svg>;
}

export function ThemeToggle() {
  const [mode, cycle] = useTheme();
  const label = mode === "auto"
    ? "الوضع: تلقائي (حسب الجهاز)"
    : mode === "light"
      ? "الوضع: فاتح"
      : "الوضع: داكن";
  const next = mode === "auto" ? "فاتح" : mode === "light" ? "داكن" : "تلقائي (حسب الجهاز)";

  return <button
    type="button"
    className="theme-toggle"
    onClick={cycle}
    aria-label={label}
    title={label + " — النقر التالي: " + next}
  >
    {mode === "light" ? <SunIcon /> : mode === "dark" ? <MoonIcon /> : <AutoIcon />}
  </button>;
}
