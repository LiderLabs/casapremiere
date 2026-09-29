import Link from "next/link"
import Image from "next/image"
import { CrossSiteLink } from "@/components/cross-site-link"
import { CONTACT_EMAIL, CONTACT_EMAIL_HREF } from "@/lib/forms"
import { INTERIOR_HOME } from "@/lib/site-links"

export function Footer() {
  return (
    <footer className="py-16 md:py-24 border-t border-border">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href={INTERIOR_HOME} className="inline-block mb-6">
              <Image src="/images/casa01.svg" alt="CASA Premier" width={120} height={60} className="w-auto h-10" />
            </Link>
            <p className="text-muted-foreground leading-relaxed max-w-sm">
              CASA Premier designs interiors — space, joinery, materials and furniture — for homes at the
              estate in Adjiringanor and for clients across Accra.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-medium mb-4">Studio</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="#projects" className="hover:text-foreground transition-colors">
                  Interiors
                </Link>
              </li>
              <li>
                <Link href="#about" className="hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="#services" className="hover:text-foreground transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="#contact" className="hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <CrossSiteLink
                  target="estate"
                  surface="interior-footer"
                  className="hover:text-foreground transition-colors"
                >
                  Exterior
                </CrossSiteLink>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-medium mb-4">Connect</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a href={CONTACT_EMAIL_HREF} className="hover:text-foreground transition-colors">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a href="tel:+233555287488" className="hover:text-foreground transition-colors">
                  +233 555 287 488
                </a>
              </li>
              <li>Adjiringanor, Accra, Ghana</li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Instagram
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 CASA Premier. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
