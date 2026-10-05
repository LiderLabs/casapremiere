import { Header } from "@/components/header";
import { HeroSection } from "@/components/sections/hero-section";
import { PhilosophySection } from "@/components/sections/philosophy-section";
import { FeaturedProductsSection } from "@/components/sections/featured-products-section";
import { TechnologySection } from "@/components/sections/technology-section";
import { ServicesSection } from "@/components/sections/services-section";
import { GallerySection } from "@/components/sections/gallery-section";
import { CollectionSection } from "@/components/sections/collection-section";
import { MortgageProvider } from "@/components/mortgage/mortgage-provider";
import { EditorialSection } from "@/components/sections/editorial-section";
import { ExteriorSection } from "@/components/sections/interior-section";
import { ProcessSection } from "@/components/sections/process-section";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { FooterSection } from "@/components/sections/footer-section";
import { ContactSection } from "@/components/sections/contact-section";
import { BookingProvider } from "@/components/booking/booking-provider";
import { PropertyProvider } from "@/components/property/property-provider";
import { ShortlistProvider } from "@/components/property/shortlist-provider";
import { ShortlistFloat } from "@/components/property/shortlist-float";
import { listPublicProperties } from "@/lib/cms/public";

// The catalogue is read here, on the server, and handed down once — so the grid, the drawer
// pager and the shortlist all render from published rows rather than a hard-coded array
// (docs/cms.md D7). The page stays statically prerendered and a publish
// revalidates it (D6), which is what makes an edit live in seconds without a deploy.
//
// The "home" surface: this grid is the shop window, so it shows the published homes the admin
// flagged for the landing page and the count is theirs to choose — `/properties` is the full
// catalogue, and it has its own flag (docs/cms.md Section 9).
export default async function Home() {
  const properties = await listPublicProperties("home");

  return (
    <BookingProvider>
      {/* Outside PropertyProvider so the drawer can open the calculator, inside
          BookingProvider so the calculator can hand over to the booking modal. */}
      <MortgageProvider>
        <PropertyProvider properties={properties}>
          {/* Inside both, because the shortlist panel opens the appointment modal
              and the property drawer. */}
          <ShortlistProvider>
            <main className="min-h-screen bg-background">
              <Header />
              <HeroSection />
              <PhilosophySection />
              <FeaturedProductsSection />
              <TechnologySection />
              <ServicesSection />
              <GallerySection />
              <CollectionSection />
              <EditorialSection />
              <ExteriorSection />
              <ProcessSection />
              <TestimonialsSection />
              <ContactSection />
              <FooterSection />
              <ShortlistFloat />
            </main>
          </ShortlistProvider>
        </PropertyProvider>
      </MortgageProvider>
    </BookingProvider>
  );
}

