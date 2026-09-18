"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Phone, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name."),
  email: z.string().email("Please enter a valid email address."),
  message: z.string().min(10, "Message must be at least 10 characters."),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const contactDetails = [
  {
    icon: Mail,
    label: "Email",
    value: "projects@casapremiergh.com",
    href: "mailto:projects@casapremiergh.com",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+233 555 287 488",
    href: "tel:+233555287488",
  },
  {
    icon: MapPin,
    label: "Office",
    value: "Adjiringanor school junction Accra, Ghana",
    href: undefined,
  },
];

export function ContactSection() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });

  function onSubmit(values: ContactFormValues) {
    // No backend endpoint exists yet — wire this to an API route
    // (e.g. app/api/contact/route.ts) or an email service when ready.
    console.log("Contact form submitted:", values);
    setIsSubmitted(true);
    form.reset();
  }

  return (
    <section id="contact" className="bg-background">
      <div className="border-t border-border px-6 py-20 md:px-12 lg:px-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
          {/* Contact Details */}
          <div>
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
              Contact Us
            </p>
            <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Get in Touch
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              We would love to hear from you! Whether you have questions about
              our designs, want to discuss a project, or just want to say
              hello — our team is here to assist you.
            </p>

            <ul className="mt-10 space-y-6">
              {contactDetails.map((item) => (
                <li key={item.label} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                    <item.icon size={18} strokeWidth={1.5} />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="mt-1 block text-sm font-medium text-foreground transition-opacity hover:opacity-70"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {item.value}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Form */}
          <div className="rounded-2xl border border-border bg-secondary/50 p-6 md:p-10">
            {isSubmitted ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
                  <Check size={24} />
                </span>
                <h3 className="text-xl font-medium text-foreground">
                  Message sent
                </h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Thanks for reaching out. Our team will get back to you within
                  1–2 business days.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSubmitted(false)}
                  className="mt-2 rounded-full"
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us about your project..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full rounded-full bg-foreground text-background hover:opacity-80"
                  >
                    Send Message
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
