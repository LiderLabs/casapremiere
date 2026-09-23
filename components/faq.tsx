"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

const faqs = [
  {
    question: "Where is CASA Premier Estate?",
    answer:
      "The estate is in Adjiringanor, Accra, and our studio works from the same address. Visits are by appointment Monday to Friday, 09:00—17:00 GMT — book a visit or send us a WhatsApp.",
  },
  {
    question: "How long does an interior take?",
    answer:
      "A full interior for one of our homes typically runs 8—16 weeks from signed drawings to handover, depending on joinery and imported finishes. We confirm the schedule before work starts.",
  },
  {
    question: "Can I change the interior of a model I buy?",
    answer:
      "Yes. Layouts, joinery, finishes and electrical plans can be adapted within the structure. We explain exactly what is fixed and what is open to choice at the design stage.",
  },
  {
    question: "Do you design interiors for homes you did not build?",
    answer:
      "Yes — we take on a limited number of interior-only projects each year, and we always begin with a site visit to measure and photograph what already exists.",
  },
  {
    question: "How do you keep interiors cool in Accra?",
    answer:
      "Through design first: shading, cross ventilation, fan placement and thermal mass, supported by efficient air conditioning where it is genuinely needed.",
  },
  {
    question: "How do we start?",
    answer:
      "Begin with a consultation at the office or on site. Bring your plan, your budget and your timeline; we follow up with a scope and fee proposal.",
  },
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-20 md:py-29">
      <div className="container mx-auto px-6 md:px-12">
        <div className="max-w-3xl mb-16">
          <p className="text-muted-foreground text-sm tracking-[0.3em] uppercase mb-6">FAQ</p>
          <h2 className="text-6xl font-medium leading-[1.15] tracking-tight mb-6 text-balance lg:text-7xl">
            Questions & Answers
          </h2>
        </div>

        <div>
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-border">
              <button
                onClick={() => toggleQuestion(index)}
                className="w-full py-6 flex items-start justify-between gap-6 text-left group"
              >
                <span className="text-lg font-medium text-foreground transition-colors group-hover:text-foreground/70">
                  {faq.question}
                </span>
                <Plus
                  className={`w-6 h-6 text-foreground flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? "rotate-45" : "rotate-0"
                  }`}
                  strokeWidth={1.5}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="text-muted-foreground leading-relaxed pb-6 pr-12">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
