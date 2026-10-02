"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { CrossSiteLink } from "@/components/cross-site-link";
import { useBooking } from "@/components/booking/booking-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSectionHref } from "@/components/use-section-href";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { openBooking } = useBooking();
  // The header renders on `/` — where these sections live — and on `/properties`,
  // where a bare `#gallery` would point at nothing. See components/use-section-href.ts.
  const sectionHref = useSectionHref();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-3xl transition-all duration-300 ${isScrolled ? "bg-background/80 backdrop-blur-md rounded-full" : "bg-transparent"}`}
      style={{
        boxShadow: isScrolled ? "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px" : "none"
      }}
    >
      <div className="flex items-center justify-between transition-all duration-300 px-2 pl-5 py-2">
               {/* Logo  */}
        <Link
          href={sectionHref("#hero")}
          aria-label="CASA Premier — home"
          className="relative block h-10 w-[60px] shrink-0 overflow-hidden rounded-md bg-transparent transition-all duration-300 hover:opacity-80"
        >
          <Image
            src="/CASA1.png"
            alt="CASA Premier"
            width={500}
            height={500}
            priority
            className="absolute top-1/2 left-1/2 h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 object-contain"
          />
        </Link>
 


        {/* Desktop Navigation */}
        {/* gap-7 rather than gap-10 keeps the six links plus the theme toggle
            inside the pill's max-w-3xl at every desktop width. */}
        <nav className="hidden items-center gap-7 md:flex">
          <Link
            href={sectionHref("#properties")}
            className="text-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            Properties
          </Link>
          <Link
            href={sectionHref("#gallery")}
            className="text-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            Gallery
          </Link>
          <Link
            href={sectionHref("#services")}
            className="text-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            Services
          </Link>
          <Link
            href={sectionHref("#about")}
            className="text-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            About
          </Link>
          <Link
            href={sectionHref("#contact")}
            className="text-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            Contact
          </Link>
          {/* Into the interiors site. CrossSiteLink renders the same anchor and
              reports the click, so this surface can be ranked against the
              footer links and the interiors band. */}
          <CrossSiteLink
            target="interior"
            surface="estate-header"
            className="text-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            Interiors
          </CrossSiteLink>
        </nav>

        {/* CTA */}
        <div className="hidden items-center gap-4 md:flex">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => openBooking()}
            className="px-4 py-2 text-sm font-medium transition-all rounded-full bg-foreground text-background hover:opacity-80"
          >
            Book a Visit 
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="transition-colors md:hidden text-foreground"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="border-t border-border bg-background px-6 py-8 md:hidden rounded-b-2xl">
          <nav className="flex flex-col gap-6">
            <Link
              href={sectionHref("#properties")}
              className="text-lg text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Properties
            </Link>
            <Link
              href={sectionHref("#gallery")}
              className="text-lg text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Gallery
            </Link>
            <Link
              href={sectionHref("#services")}
              className="text-lg text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              href={sectionHref("#about")}
              className="text-lg text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <CrossSiteLink
              target="interior"
              surface="estate-header-menu"
              className="text-lg text-foreground"
              onNavigate={() => setIsMenuOpen(false)}
            >
              Interiors
            </CrossSiteLink>
            <Link
              href={sectionHref("#contact")}
              className="text-lg text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>

            <div className="flex items-center justify-between border-t border-border pt-6">
              <span className="text-lg text-foreground">Appearance</span>
              <ThemeToggle className="size-10" />
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                openBooking();
              }}
              className="mt-4 bg-foreground px-5 py-3 text-center text-sm font-medium text-background rounded-full"
            >
              Book a Consultation
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
