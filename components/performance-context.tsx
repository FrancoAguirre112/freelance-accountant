"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface PerformanceContextType {
  performanceMode: boolean;
  setPerformanceMode: (v: boolean) => void;
}

const PerformanceContext = createContext<PerformanceContextType>({
  performanceMode: true,
  setPerformanceMode: () => {},
});

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const [performanceMode, setPerformanceModeState] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("performanceMode");
      if (stored !== null) {
        setPerformanceModeState(stored === "true");
      }
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("reduce-motion", performanceMode);
  }, [performanceMode, mounted]);

  const setPerformanceMode = (v: boolean) => {
    setPerformanceModeState(v);
    try {
      localStorage.setItem("performanceMode", String(v));
    } catch {}
  };

  return (
    <PerformanceContext.Provider value={{ performanceMode, setPerformanceMode }}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  return useContext(PerformanceContext);
}
