// App state: the outage and the item list, in one reducer, saved on this device so a closed tab loses nothing.
import { useCallback, useEffect, useReducer } from "react";
import type { Place } from "./chart";
import { FREEZER_MIN_F, FRIDGE_MIN_F, MAX_F, type Item, type Outage } from "./rules";

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

// Saved data is checked field by field. Whatever is missing or wrong falls back to the stricter choice: no reading,
// doors opened, an AI match that still needs the person's Yes.
const isoOrNull = (value: unknown) => {
  if (typeof value !== "string") return null;
  const year = new Date(value).getUTCFullYear(); // NaN for a time that isn't one
  return year >= 1000 && year <= 9999 ? value : null; // a time the date fields can show
};
const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const readingOrNull = (value: unknown, minF: number) => {
  const reading = numberOrNull(value);
  return reading !== null && reading >= minF && reading <= MAX_F ? reading : null;
};
const boolOrNull = (value: unknown) => (typeof value === "boolean" ? value : null);
const FILLS: Outage["freezerFill"][] = ["full", "half", "low", "unknown"];

function cleanOutage(raw: Record<string, unknown>): Outage {
  return {
    start: isoOrNull(raw.start),
    end: isoOrNull(raw.end),
    freezerFill: FILLS.includes(raw.freezerFill as Outage["freezerFill"]) ? (raw.freezerFill as Outage["freezerFill"]) : "unknown",
    doorClosed: raw.doorClosed === true,
    fridgeTempF: readingOrNull(raw.fridgeTempF, FRIDGE_MIN_F),
    freezerTempF: readingOrNull(raw.freezerTempF, FREEZER_MIN_F),
  };
}

function cleanItem(raw: Record<string, unknown>): Item | null {
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const from = raw.from === "hand" ? "hand" : "photo";
  return {
    id: raw.id,
    name: raw.name,
    place: raw.place === "freezer" ? "freezer" : "fridge",
    row: typeof raw.row === "string" ? raw.row : null,
    cut: boolOrNull(raw.cut),
    opened: boolOrNull(raw.opened),
    ice: raw.ice === true,
    sure: raw.sure === true,
    confirmed: from === "hand" || raw.confirmed === true,
    from,
    cleared: raw.cleared === true,
  };
}

/** Saved state, or empty when there is none, it doesn't look like ours, or storage is blocked. */
export function load(storage?: Pick<Storage, "getItem">): State {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object" && Array.isArray(saved.items) && saved.outage && typeof saved.outage === "object") {
      const items: Item[] = [];
      const ids = new Set<string>();
      for (const raw of saved.items as unknown[]) {
        const item = raw && typeof raw === "object" ? cleanItem(raw as Record<string, unknown>) : null;
        if (!item) continue;
        // Two items with one id would be fixed and removed together: give the later one its own.
        while (ids.has(item.id)) item.id = `${item.id}-${items.length}`;
        ids.add(item.id);
        items.push(item);
      }
      return { outage: cleanOutage(saved.outage), items };
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

let list = 0; // goes up on Start over (here or in another tab)

/** Which item list is current. A photo answer that arrives after Start over belongs to the old list and is dropped. */
export const currentList = () => list;

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, () => load());
  useEffect(() => save(state), [state]);
  // Another tab changed the saved state: show it here instead of overwriting it later.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const next = load();
      if (next === EMPTY) list += 1;
      dispatch({ type: "replace", state: next });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const send = useCallback((action: Action) => {
    if (action.type === "reset") list += 1;
    dispatch(action);
  }, []);
  return [state, send] as const;
}
