"use client";

import { FadeImage } from "@/components/fade-image";

const features = [
  {
    image: "/images/featured4.jpg",
    span: "col-span-2 row-span-2", // Large
  },
  {
    image: "/images/featured2.jpg",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "/images/featured3.jpg",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "/images/featured4.jpg",
    span: "col-span-1 row-span-2", // Tall
  },
  {
    image: "/images/side2.jpg",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "/images/featured1.jpg",
    span: "col-span-2 row-span-1", // Wide
  },
  {
    image: "/images/side1.jpg",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "/images/herobg2.jpg",
    span: "col-span-1 row-span-2", // Tall
  },
  {
    image: "/images/herobg3.jpg",
    span: "col-span-2 row-span-1", // Wide
  },
  {
    image: "/images/herobg4.jpg",
    span: "col-span-1 row-span-1", // Small
  },
];

export function FeaturedProductsSection() {
  return (
    <section id="technology" className="relative bg-background py-20 md:py-32">
      <div className="px-4 md:px-12 lg:px-20">
        {/* Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full max-w-7xl mx-auto auto-rows-[180px] md:auto-rows-[220px]">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={`relative overflow-hidden rounded-lg border border-gray-200 ${feature.span}`}
            >
              <FadeImage
                src={feature.image || "/placeholder.svg"}
                alt={`Architecture sketch ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
