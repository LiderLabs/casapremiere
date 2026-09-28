// Affordability calculator - configuration, maths and formatters.
//
// Same contract as lib/booking.ts: the section reads every number from here, so
// the inputs, the results and any future per-property estimate can never
// disagree about the rules.
//
// The rate default is indicative only, and deliberately adjustable. Ghanaian
// lenders were quoting roughly 19-28% a year for cedi mortgages in Q2 2026,
// with subsidised public-sector schemes near 12% and USD loans around
// 10.5-11.5% - hence a 24% starting point and a range that covers all three.
// Nothing here is an offer; the disclaimer says so out loud.

export const MORTGAGE_CURRENCY = "GH₵";

export const MORTGAGE_PRICE_STEP = 50_000;
/** Neutral starting point for the price field - the visitor's own budget replaces it. */
export const MORTGAGE_DEFAULT_PRICE = 250_000;
export const MORTGAGE_MAX_PRICE = 10_000_000;

export const MORTGAGE_DEFAULT_DEPOSIT_PCT = 20;
export const MORTGAGE_MIN_DEPOSIT_PCT = 5;
export const MORTGAGE_MAX_DEPOSIT_PCT = 50;

export const MORTGAGE_DEFAULT_TERM_YEARS = 10;
export const MORTGAGE_MIN_TERM_YEARS = 5;
export const MORTGAGE_MAX_TERM_YEARS = 20;

export const MORTGAGE_DEFAULT_RATE_PCT = 24;
export const MORTGAGE_MIN_RATE_PCT = 10;
export const MORTGAGE_MAX_RATE_PCT = 35;

export const MORTGAGE_RATE_NOTE =
  "Cedi mortgages in Accra currently run about 19-28% a year; subsidised schemes and USD loans sit lower.";

export const MORTGAGE_DISCLAIMER =
  "Illustrative only - this is not a credit offer or a price list. Your lender's rate, fees and insurance will change these figures, so treat them as a starting point for a conversation.";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * `GH₵ 1,234,567`.
 *
 * Hand-rolled rather than `Intl.NumberFormat`, because the grouping must be
 * identical on the server and in the browser - a difference there is a
 * hydration mismatch, and `GH₵` is not a currency code any ICU build is
 * guaranteed to render the same way.
 */
export function formatCedis(value: number): string {
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  const grouped = String(Math.abs(rounded)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );

  return `${rounded < 0 ? "-" : ""}${MORTGAGE_CURRENCY} ${grouped}`;
}

export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

export function formatYears(years: number): string {
  return years === 1 ? "1 year" : `${years} years`;
}

export type MortgageInput = {
  price: number;
  depositPct: number;
  termYears: number;
  annualRatePct: number;
};

export type MortgageSummary = {
  /** Normalised inputs, so the copy and the figures can never drift apart. */
  price: number;
  depositPct: number;
  deposit: number;
  loan: number;
  termYears: number;
  months: number;
  annualRatePct: number;
  monthly: number;
  totalRepaid: number;
  totalInterest: number;
};

/**
 * Standard amortising repayment: `P·r / (1 - (1+r)^-n)`.
 *
 * A zero rate is handled explicitly so the maths can never divide by zero, and
 * a zero price returns zero rather than NaN.
 */
export function monthlyRepayment(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;

  const months = Math.max(1, Math.round(termYears * 12));
  const monthlyRate = annualRatePct / 100 / 12;

  if (monthlyRate <= 0) return principal / months;

  const growth = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * growth) / (growth - 1);
}

export function summariseMortgage(input: MortgageInput): MortgageSummary {
  const price = clamp(input.price, 0, MORTGAGE_MAX_PRICE);
  const depositPct = clamp(
    input.depositPct,
    MORTGAGE_MIN_DEPOSIT_PCT,
    MORTGAGE_MAX_DEPOSIT_PCT,
  );
  const termYears = clamp(
    input.termYears,
    MORTGAGE_MIN_TERM_YEARS,
    MORTGAGE_MAX_TERM_YEARS,
  );
  const annualRatePct = clamp(
    input.annualRatePct,
    MORTGAGE_MIN_RATE_PCT,
    MORTGAGE_MAX_RATE_PCT,
  );

  const deposit = (price * depositPct) / 100;
  const loan = Math.max(0, price - deposit);
  const monthly = monthlyRepayment(loan, annualRatePct, termYears);
  const months = Math.max(1, Math.round(termYears * 12));
  const totalRepaid = monthly * months;

  return {
    price,
    depositPct,
    deposit,
    loan,
    termYears,
    months,
    annualRatePct,
    monthly,
    totalRepaid,
    // Rounding can otherwise surface "-GH₵ 0".
    totalInterest: Math.max(0, totalRepaid - loan),
  };
}

/** One line summarising the estimate, used when the figures are handed to the studio. */
export function describeMortgage(summary: MortgageSummary): string {
  return `Budget estimate: ${formatCedis(summary.monthly)} a month on ${formatCedis(
    summary.price,
  )} - ${formatPercent(summary.depositPct)} deposit, ${formatYears(
    summary.termYears,
  )} at ${formatPercent(summary.annualRatePct)}.`;
}
