"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_PORTFOLIO_CONTENT } from "@/data/portfolio-content.default";
import {
  loadPortfolioContent,
  resetPortfolioContent as resetStoredPortfolioContent,
  savePortfolioContent as saveStoredPortfolioContent,
} from "@/services/portfolio-content.storage";
import type { PortfolioContent } from "@/types/portfolio-content";

interface PortfolioContentContextValue {
  readonly content: PortfolioContent;
  readonly isReady: boolean;
  readonly updatePortfolioContent: (content: PortfolioContent) => void;
  readonly savePortfolioContent: (content: PortfolioContent) => Promise<void>;
  readonly resetPortfolioContent: () => void;
}

const PortfolioContentContext = createContext<PortfolioContentContextValue | null>(null);

export function PortfolioContentProvider({ children }: { readonly children: React.ReactNode }) {
  const [content, setContent] = useState<PortfolioContent>(DEFAULT_PORTFOLIO_CONTENT);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setContent(loadPortfolioContent());
      setIsReady(true);
    }, 0);

    function syncFromStorage(event: StorageEvent) {
      if (event.key === null || event.key === "lhcc-portfolio-content") {
        setContent(loadPortfolioContent());
      }
    }

    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const updatePortfolioContent = useCallback((nextContent: PortfolioContent) => {
    setContent(nextContent);
  }, []);

  const savePortfolioContent = useCallback(async (nextContent: PortfolioContent) => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
    saveStoredPortfolioContent(nextContent);
    setContent(nextContent);
  }, []);

  const resetPortfolioContent = useCallback(() => {
    setContent(resetStoredPortfolioContent());
  }, []);

  const value = useMemo<PortfolioContentContextValue>(() => ({
    content,
    isReady,
    updatePortfolioContent,
    savePortfolioContent,
    resetPortfolioContent,
  }), [content, isReady, resetPortfolioContent, savePortfolioContent, updatePortfolioContent]);

  return <PortfolioContentContext.Provider value={value}>{children}</PortfolioContentContext.Provider>;
}

export function usePortfolioContent(): PortfolioContentContextValue {
  const context = useContext(PortfolioContentContext);
  if (!context) throw new Error("usePortfolioContent must be used within PortfolioContentProvider");
  return context;
}

