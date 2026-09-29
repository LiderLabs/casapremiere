"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useForm as useFormspreeForm,
  ValidationError,
} from "@formspree/react";
import { Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOOKING_SERVICES } from "@/lib/booking";
import {
  CONTACT_EMAIL,
  CONTACT_EMAIL_HREF,
  FORMSPREE_FORM_ID,
  buildContactSubmission,
  type FormspreeSubmission,
} from "@/lib/forms";

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

/**
 * The enquiry form.
 *
 * Loaded as its own chunk by `contact-section.tsx`: react-hook-form, zod, the
 * Radix select and the Formspree client are dead weight for a visitor who only
 * reads the page, so the section renders its details column without them.
 *
 * Validation stays the site's own (zod, inline, on the same field objects the
 * rest of the app uses) and delivery goes to Formspree. The two are kept apart
 * on purpose: the success view is shown only once Formspree has accepted the
 * post, so the page never claims a message was delivered when it was not.
 */
export function ContactFormPanel() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const gotchaRef = useRef<HTMLInputElement>(null);

  const [submission, submitToFormspree, resetSubmission] =
    useFormspreeForm<FormspreeSubmission>(FORMSPREE_FORM_ID);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  // Formspree owns the outcome: `succeeded` is set only after the endpoint has
  // accepted the submission, and `errors` carries whatever it refused.
  useEffect(() => {
    if (!submission.succeeded) return;
    setIsSubmitted(true);
    form.reset();
  }, [submission.succeeded, form]);

  async function onSubmit(values: ContactFormValues) {
    await submitToFormspree(
      buildContactSubmission({
        ...values,
        gotcha: gotchaRef.current?.value ?? "",
      }),
    );
  }

  function handleSendAnother() {
    resetSubmission();
    setIsSubmitted(false);
  }

  // A failed request, a blocked form or a form id that no longer exists arrives
  // as a *form* error (one with no `field`), so it is rendered here and given a
  // fallback the visitor can act on. Field errors from Formspree are rendered
  // next to the field they belong to, with the library's own `ValidationError`.
  const formErrors = submission.errors?.getFormErrors() ?? [];

  if (isSubmitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
          <Check size={24} />
        </span>
        <h3 className="text-xl font-medium text-foreground">Message sent</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thanks for reaching out. Our team will reply within one business day.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={handleSendAnother}
          className="mt-2 rounded-full"
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <h3 className="mb-6 text-xl font-medium text-foreground">
        Tell Us About Your Project
      </h3>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Honeypot - visually hidden, skipped by keyboard and AT. Read off the
            DOM at submit time so a bot that fills it is discarded by Formspree
            even though the payload is built by hand. */}
        <input
          ref={gotchaRef}
          type="text"
          name="_gotcha"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

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
              <ValidationError
                errors={submission.errors}
                field="name"
                className="text-sm text-destructive"
              />
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
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
              <ValidationError
                errors={submission.errors}
                field="email"
                className="text-sm text-destructive"
              />
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
              <ValidationError
                errors={submission.errors}
                field="phone"
                className="text-sm text-destructive"
              />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="projectType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Type</FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
              <ValidationError
                errors={submission.errors}
                field="projectType"
                className="text-sm text-destructive"
              />
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
              <ValidationError
                errors={submission.errors}
                field="message"
                className="text-sm text-destructive"
              />
            </FormItem>
          )}
        />

        {formErrors.length > 0 ? (
          <p role="alert" className="text-sm leading-relaxed text-destructive">
            {formErrors.map((error) => error.message).join(" ")} Or email us at{" "}
            <a href={CONTACT_EMAIL_HREF} className="underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={submission.submitting}
          className="w-full rounded-full bg-foreground text-background hover:opacity-80"
        >
          {submission.submitting ? "Sending..." : "Send Message"}
        </Button>
      </form>
    </Form>
  );
}
