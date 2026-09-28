"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";

import type { MortgageDialogPrefill } from "./mortgage-dialog";

// Mounted on first open, so the calculator's markup and sliders stay out of the
// landing bundle - the same approach the booking modal and the property drawer
// take.
const MortgageDialog = dynamic(
  () => import("./mortgage-dialog").then((mod) => mod.MortgageDialog),
  { ssr: false },
);

type MortgageContextValue = {
  isOpen: boolean;
  /** Opens the affordability calculator, optionally prefilled from a home. */
  openCalculator: (prefill?: MortgageDialogPrefill) => void;
  closeCalculator: () => void;
};

const MortgageContext = createContext<MortgageContextValue | null>(null);

/**
 * Owns the affordability calculator dialog, so any surface can open it:
 * the property drawer (with that home's figures) and the contact section.
 *
 * Mount it inside BookingProvider - the dialog's "Discuss this budget" hands
 * over to the appointment modal - and outside PropertyProvider, because the
 * drawer asks to open the calculator.
 */
export function MortgageProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [prefill, setPrefill] = useState<MortgageDialogPrefill | undefined>();

  const openCalculator = useCallback((nextPrefill?: MortgageDialogPrefill) => {
    setPrefill(nextPrefill);
    setHasOpened(true);
    setIsOpen(true);
  }, []);

  const closeCalculator = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, openCalculator, closeCalculator }),
    [isOpen, openCalculator, closeCalculator],
  );

  return (
    <MortgageContext.Provider value={value}>
      {children}
      {/* Mounted once, on first open, so the close animation can play. */}
      {hasOpened ? (
        <MortgageDialog
          open={isOpen}
          onOpenChange={(next) => {
            if (!next) closeCalculator();
          }}
          prefill={prefill}
        />
      ) : null}
    </MortgageContext.Provider>
  );
}

export function useMortgage() {
  const context = useContext(MortgageContext);

  if (!context) {
    throw new Error("useMortgage must be used inside a MortgageProvider");
  }

  return context;
}
