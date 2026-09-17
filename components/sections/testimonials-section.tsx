"use client";

import Image from "next/image";

export function TestimonialsSection() {
  return (
    <section id="about" className="bg-background">
      {/* About Image with Text Overlay */}
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/9]">
        <Image
          src="/images/testimonial-house.png"
          alt="Modern corten steel architecture in natural landscape"
          fill
          className="object-cover"
        />
        {/* Fade gradient overlay - dark at bottom fading to transparent at top */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent md:from-black/70 md:via-black/30" />
        
        {/* Text Overlay */}
        <div className="absolute inset-0 flex items-end justify-center px-4 pb-10 sm:px-6 sm:pb-14 md:px-12 md:pb-24 lg:px-20 lg:pb-32">
          <p className="mx-auto max-w-5xl text-lg leading-relaxed text-white sm:text-xl md:text-3xl lg:text-[2.5rem] lg:leading-snug text-center">
            A passive house that combines contemporary design with environmental respect — 
            built for those who refuse to choose between modern comfort and ecological responsibility.
          </p>
        </div>
      </div>
    </section>
  );
}
