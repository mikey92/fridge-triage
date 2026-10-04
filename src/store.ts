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
  | { type: "reset" };

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
  }
}

let counter = 0;
export function newItem(fields: { name: string; place: Place; row: string | null } & Partial<Item>): Item {
  counter += 1;
  return { id: `${Date.now().toString(36)}-${counter}`, cut: null, opened: null, ice: false, sure: true, from: "hand", cleared: false,
    ...fields };
}

/** Saved state, or empty when there is none or it doesn't look like ours. */
export function load(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): State {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object" && Array.isArray(saved.items) && saved.outage && typeof saved.outage === "object") {
      return { outage: { ...EMPTY_OUTAGE, ...saved.outage }, items: saved.items.filter((item: Item) => item && typeof item.id === "string") };
    }
  } catch {
    // unreadable or blocked storage: start fresh
  }
  return EMPTY;
}

export function save(state: State, storage: Pick<Storage, "setItem" | "removeItem"> | undefined = globalThis.localStorage) {
  try {
    if (state === EMPTY) storage?.removeItem(STORAGE_KEY);
    else storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // private mode or full storage: the app still works for this visit
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, () => load());
  useEffect(() => save(state), [state]);
  return [state, dispatch] as const;
}
