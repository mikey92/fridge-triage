import { describe, expect, it } from "vitest";
import { outageTimeProblem } from "../src/components/OutageForm";
import { cleanItems } from "../worker/recognize";
import { EMPTY, load, newItem, save, STORAGE_KEY } from "../src/store";

const blocked = {
  getItem: () => { throw new DOMException("blocked", "SecurityError"); },
  setItem: () => { throw new DOMException("blocked", "SecurityError"); },
  removeItem: () => { throw new DOMException("blocked", "SecurityError"); },
};

describe("saved state", () => {
  it("starts empty instead of crashing when site data is blocked", () => {
    expect(load(blocked)).toBe(EMPTY);
    expect(() => save({ ...EMPTY, items: [] }, blocked)).not.toThrow();
  });

  it("drops saved values of the wrong type instead of showing NaN or crashing", () => {
    const saved = {
      outage: { start: "not a date", end: 12, freezerFill: "packed", doorClosed: "yes", fridgeTempF: "45", freezerTempF: null },
      items: [{ id: "a", name: "milk", place: "fridge", row: "r-milk", sure: "no" }, { name: "no id" }, null],
    };
    const state = load({ getItem: (key: string) => (key === STORAGE_KEY ? JSON.stringify(saved) : null) });
    expect(state.outage).toEqual({ start: null, end: null, freezerFill: "unknown", doorClosed: true, fridgeTempF: null, freezerTempF: null });
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ id: "a", row: "r-milk", cut: null, opened: null, ice: false, sure: true, confirmed: true,
      from: "hand" });
  });

  it("keeps the AI's matches unconfirmed until the person says yes", () => {
    expect(newItem({ name: "grapes", place: "fridge", row: "r-fruit-whole", from: "photo" }).confirmed).toBe(false);
    expect(newItem({ name: "grapes", place: "fridge", row: "r-fruit-whole" }).confirmed).toBe(true);
    const saved = { outage: EMPTY.outage, items: [
      { id: "a", name: "grapes", place: "fridge", row: "r-fruit-whole", from: "photo", sure: true },
      { id: "b", name: "peas", place: "fridge", row: "r-veg-cooked", from: "photo", sure: true, confirmed: true },
    ] };
    const state = load({ getItem: () => JSON.stringify(saved) });
    expect(state.items.map((item) => item.confirmed)).toEqual([false, true]);
  });
});

describe("outage times", () => {
  const now = Date.parse("2026-10-04T20:00:00Z");
  it("flags a start in the future and an end before the start", () => {
    expect(outageTimeProblem({ ...EMPTY.outage, start: "2026-10-05T08:00:00Z" }, now).start).toMatch(/future/);
    expect(outageTimeProblem({ ...EMPTY.outage, start: "2026-10-04T10:00:00Z", end: "2026-10-04T08:00:00Z" }, now).end).toMatch(/before/);
    expect(outageTimeProblem({ ...EMPTY.outage, start: "2026-10-04T10:00:00Z", end: "2026-10-04T18:00:00Z" }, now)).toEqual({});
  });
});

describe("recognizer answers", () => {
  it("puts every item where the person said the photo is from, and never calls look-alike rows sure", () => {
    const items = cleanItems({ items: [
      { name: "whole raw turkey", place: "freezer", row: "f-meat", cut: null, opened: null, sure: true },
      { name: "block of butter", place: "fridge", row: "r-butter", cut: null, opened: null, sure: true },
      { name: "carton of eggs", place: "fridge", row: "r-eggs", cut: null, opened: null, sure: true },
    ] }, "fridge");
    expect(items.map((item) => [item.place, item.row, item.sure])).toEqual([
      ["fridge", "r-meat", false], ["fridge", "r-butter", false], ["fridge", "r-eggs", true]]);
  });

  it("never calls a match sure when the model picked a row from the other appliance's chart", () => {
    const [item] = cleanItems({ items: [{ name: "frozen mango", place: "fridge", row: "f-fruit", cut: null, opened: null, sure: true }] });
    expect(item.row).toBe("r-fruit-cut");
    expect(item.sure).toBe(false);
  });
});
