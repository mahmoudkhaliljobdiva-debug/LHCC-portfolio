"use client";

import { useLayoutEffect, useRef } from "react";

export function HomeHeroEntrance({ children }: { readonly children: React.ReactNode }) {
  const heroRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    hero.classList.add('lhcc-hero-waiting');
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      hero.classList.remove('lhcc-hero-waiting');
      hero.classList.add('lhcc-hero-entered');
      observer.disconnect();
    }, { threshold: 0.08 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return <div ref={heroRef} className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:py-20 lg:min-h-[690px] lg:grid-cols-[1.04fr_.96fr] lg:gap-14 lg:px-8">{children}</div>;
}
