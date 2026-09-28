"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MortgageCalculator } from "@/components/mortgage/mortgage-calculator";
import { useBooking } from "@/components/booking/booking-provider";
import type { BookingService } from "@/lib/booking";
import {
  CROSS_SELL_BOOKING_EVENT,
  crossSellBookingAnalyticsProps,
} from "@/lib/cross-sell";
import { track } from "@vercel/analytics";

/** Matches the dialog's close transition, so two overlays never fight for focus. */
const HANDOFF_MS = 300;

export type MortgageDialogPrefill = {
  initialPrice?: number;
  propertyContext?: string;
};

type MortgageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: MortgageDialogPrefill;
};

export function MortgageDialog({
  open,
  onOpenChange,
  prefill,
}: MortgageDialogProps) {
  const { openBooking } = useBooking();

  /**
   * Close this dialog first, then hand the visitor (and their figures) to the
   * appointment modal - the same sequence the property drawer and the shortlist
   * panel use, so only one overlay is ever live.
   */
  const handoff = (service: BookingService, notes: string) => {
    onOpenChange(false);
    window.setTimeout(
      () =>
        openBooking({
          service,
          location: prefill?.propertyContext,
          notes,
        }),
      HANDOFF_MS,
    );
  };

  const discuss = (estimate: string) => handoff("Buy a property", estimate);

  /**
   * Cross-sell: the same budget, put to the interiors studio rather than the
   * sales team. Reported separately because this never navigates between the
   * sites, so there is no `src` for it to show up under.
   */
  const designInterior = (estimate: string) => {
    track(
      CROSS_SELL_BOOKING_EVENT,
      crossSellBookingAnalyticsProps("estate-mortgage", "Interior design"),
    );
    handoff("Interior design", `${estimate}\nInterior design for this home.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-hidden p-0 sm:max-w-2xl">
        <div className="flex max-h-[90dvh] flex-col">
          <div className="border-b border-border px-6 py-5 pr-14">
            <DialogHeader>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Affordability
              </p>
              <DialogTitle className="text-2xl font-medium tracking-tight text-foreground">
                Estimate the monthly
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {prefill?.propertyContext
                  ? `Indicative repayments for ${prefill.propertyContext}. Adjust anything that differs from your lender's terms.`
                  : "Indicative repayments on a Ghanaian mortgage. Adjust the price, deposit, term and rate."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {/* Keyed on the prefill so opening this from a different home starts
                from that home's figures rather than the last visitor's edits. */}
            <MortgageCalculator
              key={`${prefill?.propertyContext ?? "general"}-${prefill?.initialPrice ?? 0}`}
              initialPrice={prefill?.initialPrice}
              propertyContext={prefill?.propertyContext}
              onDiscuss={discuss}
              onDesignInterior={designInterior}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
