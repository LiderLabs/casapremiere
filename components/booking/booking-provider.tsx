"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { BookingPrefill } from "@/lib/booking";

// Loaded on first open so the dialog, calendar and form code stay out of the
// initial page bundle - the header trigger is always rendered, so this keeps
// the landing page light.
const BookingModal = dynamic(
  () => import("./booking-modal").then((mod) => mod.BookingModal),
  { ssr: false },
);

type BookingContextValue = {
  isOpen: boolean;
  openBooking: (prefill?: BookingPrefill) => void;
  closeBooking: () => void;
};

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [prefill, setPrefill] = useState<BookingPrefill | null>(null);

  const openBooking = useCallback((nextPrefill?: BookingPrefill) => {
    setPrefill(nextPrefill ?? null);
    setHasOpened(true);
    setIsOpen(true);
  }, []);

  const closeBooking = useCallback(() => setIsOpen(false), []);

  // Deep links: /#book or /?book=1 open the modal directly.
  useEffect(() => {
    const { hash, search } = window.location;
    if (hash === "#book" || new URLSearchParams(search).get("book") === "1") {
      openBooking();
    }
  }, [openBooking]);

  const value = useMemo(
    () => ({ isOpen, openBooking, closeBooking }),
    [isOpen, openBooking, closeBooking],
  );

  return (
    <BookingContext.Provider value={value}>
      {children}
      {/* Mounted once, on first open, so the close animation can play. */}
      {hasOpened ? (
        <BookingModal
          open={isOpen}
          onOpenChange={setIsOpen}
          prefill={prefill ?? undefined}
        />
      ) : null}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);

  if (!context) {
    throw new Error("useBooking must be used inside a BookingProvider");
  }

  return context;
}
