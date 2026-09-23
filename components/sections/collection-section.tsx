"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeImage } from "@/components/fade-image";

const properties = [
  {
    id: 1,
    name: "The Residence",
    location: "adjiringanor, Accra",
    meta: "Bedroom-",
    description: "A contemporary residence combining generous living spaces, refined finishes and seamless indoor-outdoor living.",
    price: "GH₵ --",
    image: "/images/model1.jpg",
    href: "#contact",
  },
  {
    id: 2,
    name: "The Premier home",
    location: "Adjiringanor, Accra",
    meta: "Bedroom--",
    description: "Sophisticated city living with carefully considered interiors, premium finishes and exceptional attention to detail.",
    price: "GH₵---",
    image: "/images/mono_1.jpg",
    href: "#contact",
  },
  {
    id: 3,
    name: "The Heights",
    location: " Adjiringanor, Accra",
    meta: "Bedrooms --",
    description: "A modern private residence designed around natural light, privacy and effortless entertaining.",
    price: "GH₵---",
    image: "/images/hero-bg1.jpg",
    href: "#contact",
  },
];

export function CollectionSection() {
  return (
    <section id="properties" className="bg-background">
      {/* Section Title */}
      <div className="px-6 py-20 md:px-12 lg:px-20 md:py-10">
        <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
          Selected Portfolio
        </p>
        <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Featured Properties
        </h2>
      </div>

      {/* Properties Grid/Carousel */}
      <div className="pb-24">
        {/* Mobile: Horizontal Carousel */}
        <div className="flex gap-6 overflow-x-auto px-6 pb-4 md:hidden snap-x snap-mandatory scrollbar-hide">
          {properties.map((property) => (
            <div key={property.id} className="group flex-shrink-0 w-[75vw] snap-center">
              {/* Image */}
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-secondary">
                <FadeImage
                  src={property.image || "/placeholder.svg"}
                  alt={property.name}
                  fill
                  className="object-cover group-hover:scale-105"
                />
              </div>

              {/* Content */}
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-foreground">
                      {property.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {property.location} · {property.meta}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {property.description}
                    </p>
                    <Link
                      href={property.href}
                      className="mt-4 inline-flex items-center gap-1 text-sm text-foreground transition-opacity hover:opacity-70"
                    >
                      View Property
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <span className="text-lg font-medium text-foreground">
                    {property.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 md:px-12 lg:px-20">
          {properties.map((property) => (
            <div key={property.id} className="group">
              {/* Image */}
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-secondary">
                <FadeImage
                  src={property.image || "/placeholder.svg"}
                  alt={property.name}
                  fill
                  className="object-cover group-hover:scale-105"
                />
              </div>

              {/* Content */}
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-foreground">
                      {property.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {property.location} · {property.meta}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {property.description}
                    </p>
                    <Link
                      href={property.href}
                      className="mt-4 inline-flex items-center gap-1 text-sm text-foreground transition-opacity hover:opacity-70"
                    >
                      View Property
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <span className="font-medium text-foreground text-2xl">
                    {property.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
