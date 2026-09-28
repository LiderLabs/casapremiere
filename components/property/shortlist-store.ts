"use client";

import { useSyncExternalStore } from "react";

import { getPropertyBySlug } from "@/lib/properties";

/**
 * Shortlist state - one external store rather than React context.
 *
 * It cannot live in context because the property drawer is rendered by
 * PropertyProvider as a *sibling* of that provider's children, so the drawer
 * sits outside anything we nest under the page. A module-level store that the
 * cards and the drawer both read through `useSyncExternalStore` keeps a single
 * source of truth no matter how the providers are ordered.
 *
 * Only slugs are stored: lib/properties.ts stays the source of truth for the
 * content itself, so a price edit shows up immediately and a home removed from
 * the data file drops out of the list instead of rendering a broken card.
 */

export const SHORTLIST_STORAGE_KEY = "casa.shortlist.v1";

/** Long enough for a real house hunt, short enough to keep the WhatsApp text sane. */
export const MAX_SHORTLIST = 10;

const EMPTY: readonly string[] = Object.freeze([]);

type Listener = () => void;

let listeners: Listener[] = [];
let hasStorageListener = false;
let hasRead = false;
let current: readonly string[] = EMPTY;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SHORTLIST_STORAGE_KEY);
  } catch {
    // Private mode or disabled storage: the list stays in memory for the session.
    return null;
  }
}

function parse(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;

  try {
    const parsed: unknown = JSON.parse(raw);
    const slugs = Array.isArray(parsed)
      ? parsed
      : (parsed as { slugs?: unknown } | null)?.slugs;

    if (!Array.isArray(slugs)) return EMPTY;

    return Object.freeze(
      slugs
        .filter((slug): slug is string => typeof slug === "string")
        // Drop anything that is no longer in lib/properties.ts.
        .filter((slug) => Boolean(getPropertyBySlug(slug)))
        .slice(0, MAX_SHORTLIST),
    );
  } catch {
    return EMPTY;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function write(slugs: readonly string[]) {
  current = Object.freeze([...slugs]);
  hasRead = true;

  try {
    window.localStorage.setItem(
      SHORTLIST_STORAGE_KEY,
      JSON.stringify({ v: 1, slugs: current }),
    );
  } catch {
    // Best effort - the in-memory list still works for this session.
  }

  emit();
}

/** Read storage once, then trust the in-memory mirror. */
function ensureRead() {
  if (hasRead) return;
  hasRead = true;
  current = parse(readRaw());
}

/** Another tab wrote: adopt its list. */
function reload() {
  hasRead = true;
  current = parse(readRaw());
  emit();
}

/**
 * `useSyncExternalStore` compares snapshots by reference, so this must return
 * the same array until something actually changes - hence the mirror rather
 * than a fresh parse per call.
 */
function getSnapshot(): readonly string[] {
  ensureRead();
  return current;
}

function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function subscribe(listener: Listener) {
  listeners = [...listeners, listener];

  // One shared subscription per tab, so a save in another tab updates this one.
  if (!hasStorageListener && typeof window !== "undefined") {
    hasStorageListener = true;
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === SHORTLIST_STORAGE_KEY) reload();
    });
  }

  return () => {
    listeners = listeners.filter((existing) => existing !== listener);
  };
}

export type ShortlistToggleResult = "added" | "removed" | "full";

/** Newest first, so the panel leads with whatever was just saved. */
export function toggleShortlist(slug: string): ShortlistToggleResult {
  ensureRead();

  if (current.includes(slug)) {
    write(current.filter((saved) => saved !== slug));
    return "removed";
  }

  if (current.length >= MAX_SHORTLIST) return "full";

  write([slug, ...current]);
  return "added";
}

export function removeFromShortlist(slug: string) {
  ensureRead();
  write(current.filter((saved) => saved !== slug));
}

export function useShortlistSlugs(): readonly string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
