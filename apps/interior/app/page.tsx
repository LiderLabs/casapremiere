import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Philosophy } from "@/components/philosophy"
import { Projects } from "@/components/projects"
import { Expertise } from "@/components/expertise"
import { FAQ } from "@/components/faq"
import { InteriorSection } from "@/components/interior-section"
import { CallToAction } from "@/components/call-to-action"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Philosophy />
      <Projects />
      <Expertise />
      <FAQ />
      <InteriorSection />
      <CallToAction />
      <Footer />
    </main>
  )
}
