// тёмная, светлая или как в системе. класс на html, экраны краски не считают
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "dark" | "light" | "system";
export const THEME_KEY = "alfa-theme";

// что человек выбрал в прошлый раз. в приватном режиме просто тёмная
export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* приватный режим */
  }
  return "dark";
}

// «как в системе» надо разложить в конкретную, css ждёт dark или light
export function resolvedTheme(choice: ThemeChoice): "dark" | "light" {
  if (choice === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return choice === "light" ? "light" : "dark";
}

// красим страницу и полоску браузера на телефоне, выбор запоминаем
export function applyTheme(choice: ThemeChoice) {
  const mode = resolvedTheme(choice);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.themeChoice = choice;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "light" ? "#F3F6F7" : "#0B0E14");
  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (apple) apple.setAttribute("content", mode === "light" ? "default" : "black-translucent");
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* приватный режим */
  }
}

type ThemeApi = { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void };

const ThemeCtx = createContext<ThemeApi>({ choice: "dark", setChoice: () => {} });

// если выбрана система, слушаем её и перекрашиваем без перезагрузки
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(() => readThemeChoice());
  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [choice]);
  return <ThemeCtx.Provider value={{ choice, setChoice }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
