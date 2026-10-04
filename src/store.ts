// App state: the outage and the item list, in one reducer, saved on this device so a closed tab loses nothing.
import { useEffect, useReducer } from "react";
import type { Place } from "./chart";
import type { Item, Outage } from "./rules";

export type State = { outage: Outage; items: Item[] };

export const STORAGE_KEY = "fridge-triage:v1";

export const EMPTY_OUTAGE: Outage = {
  start: null,
  end: null,
  freezerFill: "unknown",
  doorClosed: true,
  fridgeTempF: null,
  freezerTempF: null,
};

export const EMPTY: State = { outage: EMPTY_OUTAGE, items: [] };

export type Action =
  | { type: "outage"; patch: Partial<Outage> }
  | { type: "add"; items: Item[] }
  | { type: "update"; id: string; patch: Partial<Item> }
  | { type: "remove"; id: string }
  | { type: "reset" }
  | { type: "replace"; state: State };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "outage":
      return { ...state, outage: { ...state.outage, ...action.patch } };
    case "add":
      return { ...state, items: [...state.items, ...action.items] };
    case "update":
      return { ...state, items: state.items.map((item) => (item.id === action.id ? { ...item, ...action.patch } : item)) };
    case "remove":
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case "reset":
      return EMPTY;
    case "replace":
      return action.state;
  }
}

let counter = 0;
export function newItem(fields: { name: string; place: Place; row: string | null } & Partial<Item>): Item {
  counter += 1;
  const from = fields.from ?? "hand";
  // Items added by hand are the person's own word; the AI's matches wait for the person to confirm them.
  return { id: `${Date.now().toString(36)}-${counter}`, cut: null, opened: null, ice: false, sure: true, confirmed: from === "hand",
    cleared: false, ...fields, from };
}

const isoOrNull = (value: unknown) => (typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null);
const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const boolOrNull = (value: unknown) => (typeof value === "boolean" ? value : null);
const FILLS: Outage["freezerFill"][] = ["full", "half", "low", "unknown"];

/** Saved outage facts, each field checked; anything that isn't the right type falls back to empty. */
function cleanOutage(raw: Record<string, unknown>): Outage {
  return {
    start: isoOrNull(raw.start),
    end: isoOrNull(raw.end),
    freezerFill: FILLS.includes(raw.freezerFill as Outage["freezerFill"]) ? (raw.freezerFill as Outage["freezerFill"]) : "unknown",
    doorClosed: typeof raw.doorClosed === "boolean" ? raw.doorClosed : true,
    fridgeTempF: numberOrNull(raw.fridgeTempF),
    freezerTempF: numberOrNull(raw.freezerTempF),
  };
}

function cleanItem(raw: Record<string, unknown>): Item | null {
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  return {
    id: raw.id,
    name: raw.name,
    place: raw.place === "freezer" ? "freezer" : "fridge",
    row: typeof raw.row === "string" ? raw.row : null,
    cut: boolOrNull(raw.cut),
    opened: boolOrNull(raw.opened),
    ice: raw.ice === true,
    sure: raw.sure !== false,
    confirmed: raw.from !== "photo" || raw.confirmed === true,
    from: raw.from === "photo" ? "photo" : "hand",
    cleared: raw.cleared === true,
  };
}

/** Saved state, or empty when there is none, it doesn't look like ours, or storage is blocked. */
export function load(storage?: Pick<Storage, "getItem">): State {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object" && Array.isArray(saved.items) && saved.outage && typeof saved.outage === "object") {
      const items = (saved.items as unknown[]).flatMap((item) => (item && typeof item === "object" ? [cleanItem(item as Record<string, unknown>)] : []));
      return { outage: cleanOutage(saved.outage), items: items.filter((item): item is Item => item !== null) };
    }
  } catch {
    // unreadable or blocked storage: start fresh
  }
  return EMPTY;
}

export function save(state: State, storage?: Pick<Storage, "setItem" | "removeItem">) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (state === EMPTY) target?.removeItem(STORAGE_KEY);
    else target?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // private mode, blocked or full storage: the app still works for this visit
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, () => load());
  useEffect(() => save(state), [state]);
  // Another tab changed the saved state: show it here instead of overwriting it later.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) dispatch({ type: "replace", state: load() });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [state, dispatch] as const;
}
