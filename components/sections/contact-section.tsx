"use client";

import dynamic from "next/dynamic";
import { Mail, Phone, MapPin, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooking } from "@/components/booking/booking-provider";
import { useMortgage } from "@/components/mortgage/mortgage-provider";
import { CONTACT_EMAIL, CONTACT_EMAIL_HREF } from "@/lib/forms";

// The form is loaded as its own chunk, the same way the booking modal, the
// property drawer and the affordability dialog are: react-hook-form, zod, the
// Radix select and the Formspree client are all dead weight for a visitor who
// only reads the page.
//
// `ssr` is deliberately left at its default, so the empty form is still part of
// the prerendered HTML - no blank card and no layout shift while the chunk
// arrives; only the *code* is deferred. The form itself lives in
// `components/sections/contact-form-panel.tsx`.
const ContactFormPanel = dynamic(() =>
  import("./contact-form-panel").then((mod) => mod.ContactFormPanel),
);

const contactDetails = [
  {
    icon: Mail,
    label: "Email",
    value: CONTACT_EMAIL,
    href: CONTACT_EMAIL_HREF,
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+233 555 287 488",
    href: "tel:+233555287488",
  },
  {
    icon: MapPin,
    label: "Studio",
    value: "Adjiringanor school junction Accra, Ghana",
    href: undefined,
  },
];

export function ContactSection() {
  const { openBooking } = useBooking();
  const { openCalculator } = useMortgage();

  return (
    <section id="contact" className="bg-background">
      <div className="border-t border-border px-6 py-20 md:px-12 lg:px-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
          {/* Contact Details */}
          <div>
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
              Start a Project
            </p>
            <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Let's Create Your Next Space.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              Whether you are searching for your next property, planning a new development or ready
              to transform your interior, our team is ready to bring your vision to life.
            </p>

            <ul className="mt-10 space-y-6">
              {contactDetails.map((item) => (
                <li key={item.label} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                    <item.icon size={18} strokeWidth={1.5} />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="mt-1 block text-sm font-medium text-foreground transition-opacity hover:opacity-70"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {item.value}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => openBooking()}
                className="rounded-full"
              >
                Prefer to book a Visit?
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openCalculator()}
                className="rounded-full"
              >
                <Calculator className="size-4" aria-hidden="true" />
                Work out the monthly
              </Button>
            </div>
          </div>

          {/* Contact Form */}
          <div className="rounded-2xl border border-border bg-secondary/50 p-6 md:p-10">
            <ContactFormPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
