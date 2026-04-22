"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translate, type Lang, type TKey, displayCategory } from "./i18n";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  categoryLabel: (name: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (k) => String(k),
  categoryLabel: (n) => n,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-lang");
    if (attr === "zh" || attr === "en") {
      setLangState(attr);
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.setAttribute("data-lang", l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (k, v) => translate(lang, k, v),
      categoryLabel: (n) => displayCategory(n, lang),
    }),
    [lang, setLang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}
