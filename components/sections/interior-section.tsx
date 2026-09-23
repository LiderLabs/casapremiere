"use client";

import Link from "next/link";
import { FadeImage } from "@/components/fade-image";
import { SISTER_SITE_URL } from "@/lib/site-links";

export function ExteriorSection() {
  return (
    <section id="exterior" className="bg-background">
      <div className="border-t border-border px-6 py-20 md:px-12 lg:px-20 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-secondary">
            <FadeImage
              src="/images/mono3.jpg"
              alt="Exterior architecture"
              fill
              className="object-cover"
            />
          </div>

          {/* Content */}
          <div>
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
              The Interior
            </p>
            <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              The Art of the Interior
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              Step inside spaces where architecture, furniture, materials and light come
              together. From contemporary minimalism to warm, sophisticated interiors, we
              create environments that reflect the people who live, work and gather in them.
            </p>
            <a
              href={`${SISTER_SITE_URL}/`}
              className="mt-8 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:opacity-80"
            >
              Explore Our Interiors
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
