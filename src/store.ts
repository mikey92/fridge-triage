// App state: the outage and the item list, in one reducer.
import { useReducer } from "react";
import type { Place } from "./chart";
import type { Item, Outage } from "./rules";

export type State = { outage: Outage; items: Item[] };

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

export function useAppState(initial: State = EMPTY) {
  return useReducer(reducer, initial);
}
