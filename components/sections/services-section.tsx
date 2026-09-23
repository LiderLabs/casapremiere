"use client";

import { Building2, KeyRound, Paintbrush, Sofa } from "lucide-react";

const services = [
  {
    title: "Real Estate",
    description:
      "Discover carefully selected residential and commercial properties in sought-after locations, chosen for their potential, quality and long-term value.",
    icon: KeyRound,
  },
  {
    title: "Interior Design",
    description:
      "We transform interiors through refined materials, considered layouts, bespoke furniture and a distinctive design language tailored to each client.",
    icon: Sofa,
  },
  {
    title: "Property Development",
    description:
      "From concept to completion, we develop spaces that combine strong architectural character, practical functionality and enduring appeal.",
    icon: Building2,
  },
  {
    title: "Renovation & Styling",
    description:
      "Reimagine existing spaces with strategic renovations, curated finishes and interiors designed around the way you live.",
    icon: Paintbrush,
  },
];

export function ServicesSection() {
  return (
    <section id="services" className="bg-background">
      <div className="border-t border-border px-6 py-20 md:px-12 lg:px-20 md:py-28">
        <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
          Our Services
        </p>
        <h2 className="max-w-2xl text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          From Property to Possibility.
        </h2>

        <div className="mt-14 grid gap-10 md:mt-16 md:grid-cols-2 md:gap-x-16 md:gap-y-14">
          {services.map((service) => {
            const Icon = service.icon;

            return (
              <div key={service.title}>
                <Icon
                  className="mb-5 h-8 w-8 text-foreground"
                  strokeWidth={1.25}
                  aria-hidden="true"
                />
                <h3 className="text-xl font-medium text-foreground">
                  {service.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
