"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { usePerformance } from "@/components/performance-context";

/**
 * Fade-in + slide-up for a container's direct children (staggered).
 * Skipped when performance mode is on.
 */
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { delay?: number; stagger?: number; y?: number; duration?: number }
) {
  const ref = useRef<T>(null);
  const { performanceMode } = usePerformance();
  const { delay = 0, stagger = 0.06, y = 16, duration = 0.45 } = options ?? {};

  useEffect(() => {
    if (performanceMode || !ref.current) return;
    const children = ref.current.children;
    if (children.length === 0) return;

    gsap.set(children, { opacity: 0, y });
    gsap.to(children, {
      opacity: 1,
      y: 0,
      duration,
      stagger,
      delay,
      ease: "power2.out",
      clearProps: "transform",
    });
  }, [performanceMode, delay, stagger, y, duration]);

  return ref;
}

/**
 * Counter animation for KPI numbers.
 * Skipped when performance mode is on.
 */
export function useCountUp(
  targetValue: number,
  options?: { duration?: number; delay?: number; prefix?: string; decimals?: number }
) {
  const ref = useRef<HTMLDivElement>(null);
  const { performanceMode } = usePerformance();
  const { duration = 0.8, delay = 0.15, prefix = "$", decimals = 2 } = options ?? {};

  useEffect(() => {
    if (!ref.current) return;
    if (performanceMode) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: targetValue,
      duration,
      delay,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = `${prefix}${obj.val.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}`;
        }
      },
    });
  }, [performanceMode, targetValue, duration, delay, prefix, decimals]);

  return ref;
}
