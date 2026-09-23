"use client";

import { useRef, useState, useEffect, useCallback } from "react";

const specs = [
  { label: "Luxury Homes", value: "Residential" },
  { label: "Workspaces ", value: "Commercial" },
  { label: "Complete Design Services", value: "Interior" },
  { label: "End-to-End Projects", value: "Development" },
];


const YOUTUBE_VIDEO_ID = "vJlmnCnwPjk";

// autoplay=1 only works together with mute=1 (browser autoplay policy);
// loop=1 is ignored by YouTube unless playlist=<same id> is present;
// playsinline keeps iOS from forcing fullscreen; controls=0 + disablekb=1 keep the player
// as a clean background video.
const YOUTUBE_EMBED_SRC =
  `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}` +
  `?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}` +
  `&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`;

export function EditorialSection() {
  const videoRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const updateParallax = useCallback(() => {
    if (!videoRef.current) return;
    
    const rect = videoRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    // Calculate when video enters and exits viewport
    const videoTop = rect.top;
    const videoBottom = rect.bottom;
    
    // Progress from 0 (entering viewport) to 1 (exiting viewport)
    if (videoBottom > 0 && videoTop < windowHeight) {
      const progress = 1 - (videoTop + rect.height / 2) / (windowHeight + rect.height);
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updateParallax);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateParallax();
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [updateParallax]);

  // Parallax effect: video moves up as you scroll down
  const parallaxY = (scrollProgress - 0.5) * 30; // -15px to +15px range

  return (
    <section className="bg-background">
      {/* Newsletter Banner */}
      

      {/* Decorative Icons */}
      <div className="flex items-center justify-center gap-6 pb-20">
        
        
      </div>

      {/* Full-width Video with Parallax */}
      <div ref={videoRef} className="relative aspect-[16/9] w-full overflow-hidden md:aspect-[21/9]">
        {/* The 16:9 player is oversized to "cover" the wider band (the iframe equivalent of
            object-cover), so the overflow-hidden parent crops it instead of letterboxing. */}
        <div
          className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full"
          style={{
            transform: `translate3d(-50%, calc(-50% + ${parallaxY}px), 0) scale(1.15)`,
            WebkitTransform: `translate3d(-50%, calc(-50% + ${parallaxY}px), 0) scale(1.15)`,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            willChange: 'transform',
          }}
        >
          <iframe
            src={YOUTUBE_EMBED_SRC}
            title="CASA Premier — a look around the estate"
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>

      {/* Numbers heading */}
      <div className="px-6 pt-20 md:px-12 md:pt-24 lg:px-20">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">At a Glance</p>
        <h2 className="mt-4 mb-12 text-3xl font-medium tracking-tight text-foreground md:mb-16 md:text-4xl">
          Experience, measured.
        </h2>
      </div>

      {/* Specs Grid */}
      <div className="grid grid-cols-2 border-t border-border md:grid-cols-4">
        {specs.map((spec) => (
          <div
            key={spec.label}
            className="border-b border-r border-border p-6 text-center md:p-8 max-md:[&:nth-child(2n)]:border-r-0 max-md:[&:nth-child(n+3)]:border-b-0 md:border-b-0 md:[&:nth-child(4)]:border-r-0"
          >
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              {spec.label}
            </p>
            <p className="font-medium text-foreground text-3xl sm:text-4xl md:text-5xl">
              {spec.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
