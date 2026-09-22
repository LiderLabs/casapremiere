"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, Check, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BOOKING_HOURS_LABEL,
  BOOKING_HORIZON_DAYS,
  BOOKING_PHONE_DISPLAY,
  BOOKING_PHONE_HREF,
  BOOKING_SERVICES,
  BOOKING_SLOTS,
  BOOKING_SUBMISSION_ENABLED,
  BOOKING_TIME_ZONE_LABEL,
  addBookingDays,
  bookingWhatsAppHref,
  formatBookingDate,
  formatBookingWhen,
  isDateAvailable,
  startOfBookingDay,
} from "@/lib/booking";
import type { BookingPrefill } from "@/lib/booking";

const bookingSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9()\-\s]{9,20}$/, "Please enter a valid phone number."),
  service: z.enum(BOOKING_SERVICES, {
    errorMap: () => ({ message: "Please choose a service." }),
  }),
  location: z.string().trim().min(2, "Where is the project located?"),
  date: z
    .date({
      required_error: "Please pick a date.",
      invalid_type_error: "Please pick a date.",
    })
    .refine(isDateAvailable, "That date is not available - please pick another."),
  slot: z.enum(BOOKING_SLOTS, {
    errorMap: () => ({ message: "Please pick a time." }),
  }),
  notes: z
    .string()
    .trim()
    .max(1000, "Please keep notes under 1000 characters.")
    .optional(),
  // Honeypot: must stay empty. Bots fill it, humans never see it.
  company: z.string().max(0).optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

type BookingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presets applied when a trigger opens the modal (e.g. interior page CTA). */
  prefill?: BookingPrefill;
};

export function BookingModal({
  open,
  onOpenChange,
  prefill,
}: BookingModalProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitted, setSubmitted] = useState<BookingFormValues | null>(null);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    // date/service/slot are intentionally left empty so the visitor must choose
    // them - the schema tells them off if they do not.
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      location: "",
      notes: "",
      company: "",
    },
  });

  const values = form.watch();

  const today = startOfBookingDay(new Date());
  const lastBookableDay = addBookingDays(today, BOOKING_HORIZON_DAYS);

  const whenSummary =
    values.date && values.slot
      ? formatBookingWhen(values.date, values.slot)
      : values.date
        ? formatBookingDate(values.date)
        : null;

  const whatsappHref = bookingWhatsAppHref({
    name: values.name,
    email: values.email,
    phone: values.phone,
    service: values.service,
    location: values.location,
    date: values.date,
    slot: values.slot,
    notes: values.notes,
  });

  const showSuccess =
    BOOKING_SUBMISSION_ENABLED && isSubmitted && submitted !== null;

  // Apply a trigger's presets when the modal opens, keeping anything the
  // visitor already typed (the modal is not unmounted between opens).
  useEffect(() => {
    if (!open || !prefill) return;
    form.reset({ ...form.getValues(), ...prefill });
  }, [open, prefill, form]);

  function onSubmit(nextValues: BookingFormValues) {
    // Unreachable while BOOKING_SUBMISSION_ENABLED is false, because the confirm
    // button is disabled. Appointment delivery (API route + email) was
    // deliberately deferred; when it lands, send `nextValues` from here and flip
    // the flag in lib/booking.ts - everything else is already in place.
    if (!BOOKING_SUBMISSION_ENABLED) return;

    setSubmitted(nextValues);
    setIsSubmitted(true);
    form.reset();
  }

  function handleBookAnother() {
    setIsSubmitted(false);
    setSubmitted(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex max-h-[90dvh] flex-col">
          {/* Header */}
          <div className="border-b border-border px-6 py-5 pr-14">
            <DialogHeader>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Appointments
              </p>
              <DialogTitle className="text-2xl font-medium tracking-tight text-foreground">
                Book a Consultation
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Tell us about your project and pick a time that suits you. All
                times {BOOKING_TIME_ZONE_LABEL}.
              </DialogDescription>
            </DialogHeader>
          </div>

          {showSuccess ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
                <Check size={24} aria-hidden="true" />
              </span>
              <h3 className="text-xl font-medium text-foreground">
                Appointment request received
              </h3>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {submitted && submitted.date && submitted.slot
                  ? `We have your request for ${formatBookingWhen(
                      submitted.date,
                      submitted.slot,
                    )}. Our team will confirm within one business day.`
                  : "Our team will confirm your appointment within one business day."}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleBookAnother}
                className="mt-2 rounded-full"
              >
                Book another appointment
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex min-h-0 flex-1 flex-col"
              >
                {/* Honeypot - visually hidden, skipped by keyboard and AT */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="booking-company">Company</label>
                  <input
                    id="booking-company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    {...form.register("company")}
                  />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                  <div className="grid gap-8 md:grid-cols-2">
                    {/* Details column */}
                    <div className="space-y-5">
                      <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
                        Your details
                      </h3>

                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Your name"
                                autoComplete="name"
                                {...field}
                              />
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
                                autoComplete="email"
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
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="+233 555 287 488"
                                autoComplete="tel"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="service"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service</FormLabel>
                            <Select
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Choose a service" />
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
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project location</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Adjiringanor, Accra"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Tell us about your project..."
                                className="min-h-24"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Date & time column */}
                    <div className="space-y-5">
                      <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
                        Preferred date &amp; time
                      </h3>

                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <div className="text-sm font-medium text-foreground">
                              Preferred date
                            </div>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => !isDateAvailable(date)}
                              defaultMonth={today}
                              startMonth={today}
                              endMonth={lastBookableDay}
                              aria-label="Preferred date"
                              className="w-full rounded-xl border border-border bg-background p-3"
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="slot"
                        render={({ field }) => (
                          <FormItem>
                            <div className="text-sm font-medium text-foreground">
                              Preferred time
                            </div>
                            <FormControl>
                              <RadioGroup
                                value={field.value ?? ""}
                                onValueChange={field.onChange}
                                aria-label="Preferred time"
                                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                              >
                                {BOOKING_SLOTS.map((slot) => {
                                  const slotId = `booking-slot-${slot.replace(
                                    ":",
                                    "",
                                  )}`;

                                  return (
                                    <Label
                                      key={slot}
                                      htmlFor={slotId}
                                      className="h-9 w-full cursor-pointer justify-center rounded-full border border-border bg-background text-sm font-normal text-muted-foreground transition-colors hover:border-foreground/40 has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:text-foreground"
                                    >
                                      <RadioGroupItem
                                        id={slotId}
                                        value={slot}
                                        className="size-3 shrink-0 border-foreground/30 data-[state=checked]:border-foreground"
                                      />
                                      {slot}
                                    </Label>
                                  );
                                })}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3">
                        {whenSummary ? (
                          <p
                            aria-live="polite"
                            className="flex items-center gap-2 text-sm font-medium text-foreground"
                          >
                            <CalendarDays
                              className="size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            {whenSummary}
                          </p>
                        ) : (
                          <p
                            aria-live="polite"
                            className="text-sm text-muted-foreground"
                          >
                            Pick a date and a time to see your appointment
                            summary here.
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Appointments run {BOOKING_HOURS_LABEL}.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border px-6 py-4">
                  <p
                    id="booking-status"
                    role="status"
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    {BOOKING_SUBMISSION_ENABLED
                      ? `We will confirm your slot by phone or WhatsApp within one business day. ${BOOKING_HOURS_LABEL}.`
                      : `Online booking opens soon - send us your details on WhatsApp or call us and we will schedule your visit. ${BOOKING_HOURS_LABEL}.`}
                  </p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    {BOOKING_SUBMISSION_ENABLED ? (
                      <>
                        <Button
                          type="submit"
                          className="flex-1 rounded-full bg-foreground text-background hover:opacity-80"
                        >
                          Request Appointment
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="flex-1 rounded-full"
                        >
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle
                              className="size-4"
                              aria-hidden="true"
                            />
                            Send details on WhatsApp
                          </a>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          asChild
                          className="flex-1 rounded-full bg-foreground text-background hover:opacity-80"
                        >
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle
                              className="size-4"
                              aria-hidden="true"
                            />
                            Send details on WhatsApp
                          </a>
                        </Button>
                        <Button
                          type="submit"
                          disabled
                          aria-describedby="booking-status"
                          className="flex-1 rounded-full"
                        >
                          Request Appointment
                        </Button>
                      </>
                    )}
                  </div>

                  <a
                    href={BOOKING_PHONE_HREF}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Phone className="size-3.5" aria-hidden="true" />
                    Or call {BOOKING_PHONE_DISPLAY}
                  </a>
                </div>

              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

