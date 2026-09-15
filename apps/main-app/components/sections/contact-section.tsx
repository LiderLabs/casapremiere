import react from "react";
import { SISTER_SITE_URL } from "@/lib/site-links";
import { Button } from "@/components/ui/button";
import { FadeImage } from "@/components/fade-image";

export function ContactSection() {
    return (
        <section id="contact" className="bg-background">
            <div className="border-t border-border px-6 py-20 md:px-12 lg:px-20 md:py-28">
                <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16"> 
                    {/* Content */}
                    <div>
                        <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">        
            Contact Us
                        </p>
                        <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">    
            Get in Touch
                        </h2>
                        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            We would love to hear from you! Whether you have questions about our designs, want to discuss a project, or just want to say hello, feel free to reach out. Our team is here to assist you and provide the information you need.
                        </p>
                        <a
                            href={`mailto:info@casa.com`}
                            className="mt-8 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:opacity-80"
                        >
            Email Us
                        </a>
                    </div>  

                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-secondary">
                        <img
                            src="/images/contact.png"
                            alt="Contact us"
                            className="object-cover w-full h-full"
                        />
                    </div>
                </div>
            </div>      
        </section>
    );
}

