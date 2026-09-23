"use client";

const steps = [
  {
    number: "01",
    title: "Discover",
    description:
      "We begin by understanding your property, lifestyle, aspirations and vision.",
  },
  {
    number: "02",
    title: "Design",
    description:
      "Our designers develop the concept, spatial planning, materials, finishes and visual direction.",
  },
  {
    number: "03",
    title: "Refine",
    description:
      "Every detail is reviewed, from furniture and lighting to joinery and finishing touches.",
  },
  {
    number: "04",
    title: "Deliver",
    description:
      "We coordinate the execution and bring the finished space to life with precision and care.",
  },
];

export function ProcessSection() {
  return (
    <section id="process" className="bg-background">
      <div className="border-t border-border px-6 py-20 md:px-12 lg:px-20 md:py-28">
        <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
          Our Process
        </p>
        <h2 className="max-w-2xl text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          From Vision to Reality.
        </h2>

        <div className="mt-14 grid gap-10 md:mt-16 md:grid-cols-4 md:gap-8">
          {steps.map((step) => (
            <div key={step.number}>
              <p className="text-5xl font-medium leading-none text-muted-foreground/30">
                {step.number}
              </p>
              <h3 className="mt-6 text-xl font-medium text-foreground">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
