import { describe, expect, it } from "vitest";
import type { Outage } from "../src/rules";
import { EMPTY, EMPTY_OUTAGE, load, reducer, save, STORAGE_KEY } from "../src/store";
import { coldClock, fromLocalInput, hms, toLocalInput } from "../src/time";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-10-04T20:00:00Z");

const out = (hoursAgo: number, extra: Partial<Outage> = {}): Outage =>
  ({ ...EMPTY_OUTAGE, start: new Date(NOW - hoursAgo * HOUR).toISOString(), ...extra });

describe("the cold clock", () => {
  it("matches the PRD: 5 hours ago, half full → fridge past its 4 hours, freezer 19 hours left", () => {
    const clock = coldClock(out(5, { freezerFill: "half" }), NOW)!;
    expect(clock.fridgeLeftMs).toBe(-1 * HOUR);
    expect(clock.freezerLeftMs).toBe(19 * HOUR);
    expect(clock.running).toBe(true);
  });

  it("gives a full freezer 48 hours and counts not-sure as half full", () => {
    expect(coldClock(out(5, { freezerFill: "full" }), NOW)!.freezerLeftMs).toBe(43 * HOUR);
    expect(coldClock(out(5, { freezerFill: "unknown" }), NOW)!.freezerHold).toBe(24);
  });

  it("stops at the time the power came back", () => {
    const clock = coldClock(out(10, { end: new Date(NOW - 2 * HOUR).toISOString() }), NOW)!;
    expect(clock.outMs).toBe(8 * HOUR);
    expect(clock.running).toBe(false);
  });

  it("has no clock before an outage starts", () => {
    expect(coldClock(EMPTY_OUTAGE, NOW)).toBeNull();
  });

  it("formats countdowns past 24 hours", () => {
    expect(hms(19 * HOUR + 61_000)).toBe("19:01:01");
    expect(hms(-5)).toBe("0:00:00");
  });

  it("round-trips local date-time inputs", () => {
    const iso = new Date(NOW).toISOString();
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(fromLocalInput("")).toBeNull();
  });
});

describe("saving on the device", () => {
  function memory() {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
      data,
    };
  }

  it("keeps the outage and the items across a reload", () => {
    const storage = memory();
    let state = reducer(EMPTY, { type: "outage", patch: { start: new Date(NOW).toISOString(), freezerFill: "full" } });
    state = reducer(state, { type: "add", items: [{ id: "a", name: "milk", place: "fridge", row: "r-milk", cut: null, opened: null,
      ice: false, sure: true, from: "hand", cleared: false }] });
    save(state, storage);
    expect(load(storage)).toEqual(state);
  });

  it("starts fresh from unreadable storage and clears on start over", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, "{not json");
    expect(load(storage)).toBe(EMPTY);
    storage.setItem(STORAGE_KEY, JSON.stringify({ outage: EMPTY_OUTAGE, items: [] }));
    save(reducer(EMPTY, { type: "reset" }), storage);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });
});
