// Email delivery for the two public forms.
//


/** Formspree form id, i.e. https://formspree.io/f/<id>. */
export const FORMSPREE_FORM_ID = "mrpbjpjn";

/**
 * Appointment requests share the enquiry form by default, which keeps both
 * streams in one inbox and one Formspree table. Create a second form in the
 * Formspree dashboard and put its id here to separate them.
 */
export const FORMSPREE_BOOKING_FORM_ID = FORMSPREE_FORM_ID;

/** Public business address - the single source of truth for every `mailto:`. */
export const CONTACT_EMAIL = "info@liderlabs.com";
export const CONTACT_EMAIL_HREF = `mailto:${CONTACT_EMAIL}`;

/** Which surface sent a submission; forwarded as `source` so it can be filtered. */
export type SubmissionSource = "estate-contact-form" | "appointment-modal";

/**
 * The shape posted to Formspree.
 *
 * Flat strings on purpose: Formspree renders unknown keys into the email it
 * sends and the table it stores, so these names are the labels a person reads.
 * Optional keys are dropped by `JSON.stringify` when they are `undefined`,
 * which keeps an enquiry with no phone number from arriving with a blank line.
 *
 * `_subject` and `_gotcha` are Formspree's own reserved names: the first sets
 * the notification's subject, the second is the honeypot it silently discards.
 */
export type FormspreeSubmission = {
  name?: string;
  email?: string;
  phone?: string;
  /** Contact form only. */
  projectType?: string;
  message?: string;
  /** Appointment modal only. */
  service?: string;
  location?: string;
  date?: string;
  slot?: string;
  notes?: string;
  source: SubmissionSource;
  /** Page the visitor was on when they sent it. */
  page: string;
  _subject: string;
  _gotcha: string;
};

/** URL of the page a submission was made from, for attribution. */
export function currentPage(): string {
  return typeof window === "undefined" ? "" : window.location.href;
}

export type ContactFormInput = {
  name: string;
  email: string;
  phone?: string;
  projectType: string;
  message: string;
  /** Honeypot value - empty for a human, filled by bots. */
  gotcha?: string;
};

/**
 * Payload for the contact form's enquiry.
 *
 * `gotcha` is read straight off the DOM at submit time, so a bot that fills the
 * hidden field is dropped by Formspree even though the payload is built by hand
 * rather than from a `FormData`.
 */
export function buildContactSubmission(
  input: ContactFormInput,
): FormspreeSubmission {
  return {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || undefined,
    projectType: input.projectType,
    message: input.message.trim(),
    source: "estate-contact-form",
    page: currentPage(),
    _subject: `New enquiry - ${input.projectType}`,
    _gotcha: input.gotcha ?? "",
  };
}
