import { Header } from "@/components/header";
import { HeroSection } from "@/components/sections/hero-section";
import { PhilosophySection } from "@/components/sections/philosophy-section";
import { FeaturedProductsSection } from "@/components/sections/featured-products-section";
import { TechnologySection } from "@/components/sections/technology-section";
import { ServicesSection } from "@/components/sections/services-section";
import { GallerySection } from "@/components/sections/gallery-section";
import { CollectionSection } from "@/components/sections/collection-section";
import { EditorialSection } from "@/components/sections/editorial-section";
import { ExteriorSection } from "@/components/sections/interior-section";
import { ProcessSection } from "@/components/sections/process-section";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { FooterSection } from "@/components/sections/footer-section";
import { ContactSection } from "@/components/sections/contact-section";
import { BookingProvider } from "@/components/booking/booking-provider";
import { PropertyProvider } from "@/components/property/property-provider";

export default function Home() {
  return (
    <BookingProvider>
      <PropertyProvider>
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
        </main>
      </PropertyProvider>
    </BookingProvider>
  );
}

