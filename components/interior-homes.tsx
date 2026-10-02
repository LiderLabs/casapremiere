import Image from "next/image"
import { ArrowUpRight } from "lucide-react"

import { CrossSiteLink } from "@/components/cross-site-link"
import { listPublicProperties } from "@/lib/cms/public"
import { getPropertyPriceValue } from "@/lib/properties"

/**
 * Interior-side cross-sell into the estate side.
 *
 * Reads the same published rows the estate's grid and drawer read (lib/cms/public.ts), so the
 * two sites can never advertise different homes at different prices, and a home published in
 * the admin appears here on the next revalidation.
 *
 * Each card lands on `/?property=<slug>`, which the estate's PropertyProvider reads on load
 * and opens directly, so the visitor arrives at the home itself rather than at a hero with a
 * scroll to find.
 *
 * The read deliberately names no surface: `all` is every published home, which is what this
 * cross-sell means. A home kept off the landing page's grid and off the catalogue is still a
 * home this site has designed, so placement never hides it here.
 */
export async function HomesWeDesign() {
  // No argument: every published home, whatever surface flags it carries.
  const properties = await listPublicProperties()

  return (
    <section id="homes" className="py-32 md:py-29 bg-secondary/50">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
          <div className="max-w-2xl">
            <p className="text-muted-foreground text-sm tracking-[0.3em] uppercase mb-6">
              The Estate
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight mb-6">
              The homes we design for
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Every interior starts with a house. Ours are designed and built at
              Adjiringanor, Accra — open one to see the plan, the finishes and what it
              costs.
            </p>
          </div>

          <CrossSiteLink
            target="estate"
            surface="interior-homes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group shrink-0"
          >
            Browse the estate
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </CrossSiteLink>
        </div>

        <ul className="grid md:grid-cols-3 gap-6 md:gap-8">
          {properties.map((property) => {
            // The estate hides a price that is still a placeholder ("GH₵ --");
            // the same rule applies here, and `getPropertyPriceValue` is the
            // shared definition of "has a real figure".
            const hasPrice = getPropertyPriceValue(property.price) !== undefined

            return (
              <li key={property.slug}>
                <CrossSiteLink
                  target="estate"
                  surface="interior-home-card"
                  property={property.slug}
                  className="group block"
                >
                  <div className="relative overflow-hidden aspect-[4/3] mb-6 bg-secondary">
                    <Image
                      src={property.image || "/placeholder.svg"}
                      alt={`${property.name}, ${property.location}`}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-medium mb-2 group-hover:underline underline-offset-4">
                        {property.name}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {property.location}
                      </p>
                    </div>
                    {hasPrice ? (
                      <span className="text-muted-foreground text-sm shrink-0">
                        {property.price}
                      </span>
                    ) : null}
                  </div>
                </CrossSiteLink>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
