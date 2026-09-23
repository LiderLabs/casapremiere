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
import { useBooking } from "@/components/booking/booking-provider";
import { BOOKING_SERVICES } from "@/lib/booking";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name."),
  email: z.string().email("Please enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9()\-\s]{7,20}$/, "Please enter a valid phone number.")
    .optional()
    .or(z.literal("")),
  projectType: z.enum(BOOKING_SERVICES, {
    errorMap: () => ({ message: "Please choose a project type." }),
  }),
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
    label: "Studio",
    value: "Adjiringanor school junction Accra, Ghana",
    href: undefined,
  },
];

export function ContactSection() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { openBooking } = useBooking();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
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
              Start a Project
            </p>
            <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Let's Create Your Next Space.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              Whether you are searching for your next property, planning a new development or ready
              to transform your interior, our team is ready to bring your vision to life.
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

            <Button
              type="button"
              variant="outline"
              onClick={() => openBooking()}
              className="mt-10 rounded-full"
            >
              Prefer to book a Visit?
            </Button>
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
                  Thanks for reaching out. Our team will reply within one
                  business day.
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
                <h3 className="mb-6 text-xl font-medium text-foreground">
                  Tell Us About Your Project
                </h3>
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
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+233 555 287 488"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="projectType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose a project type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BOOKING_SERVICES.map((service) => (
                              <SelectItem key={service} value={service}>
                                {service}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
