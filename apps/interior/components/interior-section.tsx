import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { SISTER_SITE_URL } from "@/lib/site-links"

export function InteriorSection() {
  return (
    <section id="interior" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          {/* Image */}
          <div className="order-1 md:order-2 relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src="/images/interior-view.png"
              alt="Interior living collection"
              fill
              className="object-cover"
            />
          </div>

          {/* Content */}
          <div className="order-2 md:order-1">
            <p className="text-muted-foreground text-sm tracking-[0.3em] uppercase mb-8">
              The Exterior 
            </p>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium leading-[1.1] tracking-tight mb-8 text-balance">
              explore the exterior
            </h2>

            <p className="text-muted-foreground text-lg leading-relaxed mb-12 max-w-md">
              Experience the exterior of our architectural designs, where form meets function and aesthetics blend seamlessly with the environment. Discover how our exterior spaces are crafted to enhance the living experience, providing both beauty and practicality.
            </p>

            <a
              href={`${SISTER_SITE_URL}/`}
              className="inline-flex items-center gap-3 bg-white text-foreground border border-foreground/20 px-8 py-4 text-sm tracking-wide hover:bg-foreground hover:text-white transition-colors duration-300 group"
            >
              Explore the Exterior
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
