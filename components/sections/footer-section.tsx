"use client";

import Link from "next/link";
import { SISTER_SITE_URL } from "@/lib/site-links";
import { useBooking } from "@/components/booking/booking-provider";

type FooterLink = {
  label: string;
  href?: string;
  /** Opens the appointment booking modal instead of navigating. */
  action?: "book";
};

const footerLinks: {
  explore: FooterLink[];
  about: FooterLink[];
  service: FooterLink[];
} = {
  explore: [
    { label: "Products", href: "#products" },
    { label: "Technology", href: "#technology" },
    { label: "Gallery", href: "#gallery" },
    { label: "Accessories", href: "#accessories" },
  ],
  about: [
    { label: "Our Story", href: "#" },
    { label: "Team", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#contact" },
    { label: "Exterior", href: `${SISTER_SITE_URL}/` },
  ],
  service: [
    { label: "Consultation", action: "book" },
    { label: "Book an appointment", action: "book" },
    { label: "Installation", href: "#installation" },
    { label: "Maintenance", href: "#maintenance" },
    { label: "Support", href: "#support" },
  ],
};

function FooterLinkList({ links }: { links: FooterLink[] }) {
  const { openBooking } = useBooking();

  return (
    <ul className="space-y-3">
      {links.map((link) => (
        <li key={link.label}>
          {link.action === "book" ? (
            <button
              type="button"
              onClick={() => openBooking()}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </button>
          ) : (
            <Link
              href={link.href ?? "#"}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FooterSection() {
  return (
    <footer className="bg-background">
      {/* Main Footer Content */}
      <div className="border-t border-border px-6 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 lg:col-span-2">
            <Link href="#hero" className="text-lg font-medium text-foreground">
              CASA
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Sustainable design homes combining contemporary aesthetics with energy efficiency and eco-friendly materials.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Explore</h4>
            <FooterLinkList links={footerLinks.explore} />
          </div>

          {/* About */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">About</h4>
            <FooterLinkList links={footerLinks.about} />
          </div>

          {/* Service */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Service</h4>
            <FooterLinkList links={footerLinks.service} />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border px-6 py-6 md:px-12 lg:px-20">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-muted-foreground">
            2026 CASA. All rights reserved.
          </p>

          

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <Link
              href="#"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Instagram
            </Link>
            <Link
              href="#"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Twitter
            </Link>
            <Link
              href="#"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              YouTube
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
