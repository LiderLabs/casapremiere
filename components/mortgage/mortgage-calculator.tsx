"use client";

import { useId, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { bookingWhatsAppHref } from "@/lib/booking";
import {
  MORTGAGE_CURRENCY,
  MORTGAGE_DEFAULT_DEPOSIT_PCT,
  MORTGAGE_DEFAULT_PRICE,
  MORTGAGE_DEFAULT_RATE_PCT,
  MORTGAGE_DEFAULT_TERM_YEARS,
  MORTGAGE_DISCLAIMER,
  MORTGAGE_MAX_DEPOSIT_PCT,
  MORTGAGE_MAX_PRICE,
  MORTGAGE_MAX_RATE_PCT,
  MORTGAGE_MAX_TERM_YEARS,
  MORTGAGE_MIN_DEPOSIT_PCT,
  MORTGAGE_MIN_RATE_PCT,
  MORTGAGE_MIN_TERM_YEARS,
  MORTGAGE_PRICE_STEP,
  MORTGAGE_RATE_NOTE,
  clamp,
  describeMortgage,
  formatCedis,
  formatPercent,
  formatYears,
  summariseMortgage,
} from "@/lib/mortgage";

/** Digits only, so the field can be emptied while it is being retyped. */
function parsePrice(text: string): number {
  return clamp(Number(text.replace(/[^0-9]/g, "") || 0), 0, MORTGAGE_MAX_PRICE);
}

type SliderFieldProps = {
  /** Id of the visible label, used as the slider's accessible name. */
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  valueText: string;
  onChange: (value: number) => void;
  hint?: string;
};

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  display,
  valueText,
  onChange,
  hint,
}: SliderFieldProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span id={id} className="text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="text-sm text-muted-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(next) => onChange(next[0] ?? value)}
        min={min}
        max={max}
        step={step}
        aria-labelledby={id}
        aria-valuetext={valueText}
      />
      {hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export type MortgageCalculatorProps = {
  /**
   * Starting price. Comes from the home being viewed when it has a published
   * price; otherwise the neutral default is used, and the note under the field
   * says so.
   */
  initialPrice?: number;
  /** e.g. "The Residence, Adjiringanor" - carried into the booking prefill. */
  propertyContext?: string;
  /**
   * Called when the visitor wants to talk the figures through. The host owns
   * closing this surface before opening the booking modal.
   */
  onDiscuss: (estimate: string) => void;
  /**
   * Cross-sell: the same figures, handed to the interiors studio instead of the
   * sales team. Optional, so a host with no interiors surface to offer simply
   * omits it and the second action is not rendered.
   */
  onDesignInterior?: (estimate: string) => void;
};

export function MortgageCalculator({
  initialPrice,
  propertyContext,
  onDiscuss,
  onDesignInterior,
}: MortgageCalculatorProps) {
  // Two instances can be mounted at once (this dialog plus any future host), so
  // the label/control ids have to be unique per instance.
  const uid = useId();
  const priceId = `mortgage-price-${uid}`;
  const depositId = `mortgage-deposit-${uid}`;
  const termId = `mortgage-term-${uid}`;
  const rateId = `mortgage-rate-${uid}`;

  const [priceText, setPriceText] = useState(() =>
    String(initialPrice && initialPrice > 0 ? initialPrice : MORTGAGE_DEFAULT_PRICE),
  );
  const [depositPct, setDepositPct] = useState(MORTGAGE_DEFAULT_DEPOSIT_PCT);
  const [termYears, setTermYears] = useState(MORTGAGE_DEFAULT_TERM_YEARS);
  const [annualRatePct, setAnnualRatePct] = useState(MORTGAGE_DEFAULT_RATE_PCT);

  const summary = useMemo(
    () =>
      summariseMortgage({
        price: parsePrice(priceText),
        depositPct,
        termYears,
        annualRatePct,
      }),
    [priceText, depositPct, termYears, annualRatePct],
  );

  const estimate = describeMortgage(summary);

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-12">
      {/* Inputs */}
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <Label htmlFor={priceId}>Property price</Label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
            >
              {MORTGAGE_CURRENCY}
            </span>
            <Input
              id={priceId}
              type="number"
              inputMode="numeric"
              min={0}
              max={MORTGAGE_MAX_PRICE}
              step={MORTGAGE_PRICE_STEP}
              value={priceText}
              onChange={(event) =>
                setPriceText(event.target.value.replace(/[^0-9]/g, ""))
              }
              className="h-12 pl-12 text-base"
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {initialPrice && initialPrice > 0
              ? `${formatCedis(initialPrice)} comes from ${
                  propertyContext ?? "this home"
                } — change it to run your own numbers.`
              : "Your own budget — nothing here is a price list."}
          </p>
        </div>

        <SliderField
          id={depositId}
          label="Deposit"
          value={depositPct}
          min={MORTGAGE_MIN_DEPOSIT_PCT}
          max={MORTGAGE_MAX_DEPOSIT_PCT}
          display={formatPercent(depositPct)}
          valueText={`${formatPercent(depositPct)} deposit`}
          onChange={setDepositPct}
          hint={`${formatCedis(summary.deposit)} up front, ${formatCedis(
            summary.loan,
          )} borrowed.`}
        />

        <SliderField
          id={termId}
          label="Term"
          value={termYears}
          min={MORTGAGE_MIN_TERM_YEARS}
          max={MORTGAGE_MAX_TERM_YEARS}
          display={formatYears(termYears)}
          valueText={formatYears(termYears)}
          onChange={setTermYears}
        />

        <SliderField
          id={rateId}
          label="Interest rate"
          value={annualRatePct}
          min={MORTGAGE_MIN_RATE_PCT}
          max={MORTGAGE_MAX_RATE_PCT}
          display={`${formatPercent(annualRatePct)} a year`}
          valueText={`${formatPercent(annualRatePct)} per year`}
          onChange={setAnnualRatePct}
          hint={MORTGAGE_RATE_NOTE}
        />
      </div>

      {/* Results */}
      <div className="flex flex-col gap-8">
        <div className="rounded-2xl border border-border p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Monthly repayment
          </p>
          <p
            aria-live="polite"
            aria-atomic="true"
            className="mt-3 text-3xl font-medium tracking-tight text-foreground md:text-4xl"
          >
            {formatCedis(summary.monthly)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.price > 0
              ? `Over ${formatYears(summary.termYears)} · ${summary.months} payments`
              : "Enter a price to see a repayment."}
          </p>

          {/* Deposit vs loan. The figures are in the list below, so this bar is a
              visual proportion only. */}
          <div
            aria-hidden="true"
            className="mt-6 flex h-2 w-full overflow-hidden rounded-full bg-secondary"
          >
            <span
              className="h-full bg-foreground"
              style={{ width: `${summary.depositPct}%` }}
            />
          </div>
          <div
            aria-hidden="true"
            className="mt-3 flex items-baseline justify-between gap-4 text-xs text-muted-foreground"
          >
            <span>Deposit {formatPercent(summary.depositPct)}</span>
            <span>Loan {formatPercent(100 - summary.depositPct)}</span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-8">
          {[
            { label: "Deposit", value: formatCedis(summary.deposit) },
            { label: "Loan", value: formatCedis(summary.loan) },
            { label: "Total interest", value: formatCedis(summary.totalInterest) },
            { label: "Total repaid", value: formatCedis(summary.totalRepaid) },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-2 text-lg font-medium text-foreground">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onDiscuss(estimate)}
            className="flex-1 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            Discuss this budget
          </button>
          <a
            href={bookingWhatsAppHref({
              service: "Buy a property",
              location: propertyContext,
              notes: estimate,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Send on WhatsApp
          </a>
        </div>

        {/* Cross-sell into the interiors side of the same studio, on the same
            budget - the second question after "what is the deposit?" is "and
            what does the inside cost?". */}
        {onDesignInterior ? (
          <button
            type="button"
            onClick={() => onDesignInterior(estimate)}
            className="w-full rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Design the interior to this budget
          </button>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">
          {MORTGAGE_DISCLAIMER}
        </p>
      </div>

    </div>
  );
}
