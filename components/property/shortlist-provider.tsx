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

// Mounted on first open, so the panel markup stays out of the landing bundle -
// the same approach the booking modal and the property drawer take.
const ShortlistPanel = dynamic(
  () => import("./shortlist-panel").then((mod) => mod.ShortlistPanel),
  { ssr: false },
);

type ShortlistPanelContextValue = {
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

const ShortlistPanelContext = createContext<ShortlistPanelContextValue | null>(
  null,
);

/**
 * Owns the shortlist *panel* only. The saved slugs themselves live in
 * `shortlist-store.ts`, because the property drawer is rendered outside this
 * provider's children and still needs to read and toggle the list.
 *
 * Mount it inside BookingProvider and PropertyProvider: the panel opens the
 * appointment modal and the property drawer.
 */
export function ShortlistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const openPanel = useCallback(() => {
    setHasOpened(true);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, openPanel, closePanel }),
    [isOpen, openPanel, closePanel],
  );

  return (
    <ShortlistPanelContext.Provider value={value}>
      {children}
      {/* Mounted once, on first open, so the close animation can play. */}
      {hasOpened ? (
        <ShortlistPanel
          open={isOpen}
          onOpenChange={(next) => {
            if (!next) closePanel();
          }}
        />
      ) : null}
    </ShortlistPanelContext.Provider>
  );
}

export function useShortlistPanel() {
  const context = useContext(ShortlistPanelContext);

  if (!context) {
    throw new Error("useShortlistPanel must be used inside a ShortlistProvider");
  }

  return context;
}
