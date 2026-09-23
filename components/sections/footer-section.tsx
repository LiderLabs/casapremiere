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
    { label: "Properties", href: "#properties" },
    { label: "Gallery", href: "#gallery" },
    { label: "Developments", href: "#services" },
    { label: "Interior Design", href: `${SISTER_SITE_URL}/` },
  ],
  about: [
    { label: "About Us", href: "#about" },
    { label: "Our Approach", href: "#services" },
    { label: "Our Process", href: "#process" },
    { label: "Contact", href: "#contact" },
  ],
  service: [
    { label: "Real Estate", href: "#properties" },
    { label: "Interior Design", href: `${SISTER_SITE_URL}/` },
    { label: "Property Development", href: "#services" },
    { label: "Renovation & Styling", href: "#contact" },
    { label: "Book a consultation", action: "book" },
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
              Spaces thoughtfully designed. Properties carefully curated. Premium real estate and
              interior design in Accra, Ghana.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Explore</h4>
            <FooterLinkList links={footerLinks.explore} />
          </div>

          {/* About */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Company</h4>
            <FooterLinkList links={footerLinks.about} />
          </div>

          {/* Service */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Services</h4>
            <FooterLinkList links={footerLinks.service} />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border px-6 py-6 md:px-12 lg:px-20">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-muted-foreground">
            © 2026 CASA Premier. All rights reserved.
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
              LinkedIn
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
