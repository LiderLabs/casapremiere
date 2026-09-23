"use client";

import Image from "next/image";

export function TestimonialsSection() {
  return (
    <section id="about" className="bg-background">
      {/* About Image with Text Overlay */}
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/9]">
        <Image
          src="/images/philosophy.jpg"
          alt="CASA Premier home in its landscape, Adjiringanor, Accra"
          fill
          className="object-cover"
        />
        {/* Fade gradient overlay - dark at bottom fading to transparent at top */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent md:from-black/70 md:via-black/30" />
        
        {/* Text Overlay */}
        <div className="absolute inset-0 flex items-end justify-center px-4 pb-10 sm:px-6 sm:pb-14 md:px-12 md:pb-24 lg:px-20 lg:pb-32">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-2xl font-medium leading-snug text-white sm:text-3xl md:text-4xl lg:text-[3rem] lg:leading-tight">
              Spaces Worth Coming Home To.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/85 sm:text-lg md:text-xl lg:text-2xl">
              We believe the spaces around us shape the way we experience life. That is why we create
              properties and interiors that go beyond appearance — spaces with character, comfort and
              lasting value.  
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
