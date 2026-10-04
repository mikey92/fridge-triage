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

  it("drops saved values of the wrong type, falling back to the stricter choice, instead of showing NaN or crashing", () => {
    const saved = {
      outage: { start: "not a date", end: 12, freezerFill: "packed", doorClosed: "yes", fridgeTempF: "45", freezerTempF: null },
      items: [{ id: "a", name: "milk", place: "fridge", row: "r-milk", sure: "no" }, { name: "no id" }, null],
    };
    const state = load({ getItem: (key: string) => (key === STORAGE_KEY ? JSON.stringify(saved) : null) });
    // Doors opened (2 hours, not 4); an item of unknown origin is an AI match that still needs the person's Yes.
    expect(state.outage).toEqual({ start: null, end: null, freezerFill: "unknown", doorClosed: false, fridgeTempF: null, freezerTempF: null });
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ id: "a", row: "r-milk", cut: null, opened: null, ice: false, sure: false, confirmed: false,
      from: "photo" });
  });

  it("drops readings and times the form would never accept, and gives repeated ids their own", () => {
    const saved = {
      outage: { start: "+275760-09-13T00:00:00.000Z", end: null, freezerFill: "full", doorClosed: true, fridgeTempF: 0, freezerTempF: 150 },
      items: [
        { id: "a", name: "milk", place: "fridge", row: "r-milk", from: "hand" },
        { id: "a", name: "eggs", place: "fridge", row: "r-eggs", from: "hand" },
      ],
    };
    const state = load({ getItem: () => JSON.stringify(saved) });
    expect(state.outage).toMatchObject({ start: null, doorClosed: true, fridgeTempF: null, freezerTempF: null });
    expect(new Set(state.items.map((item) => item.id)).size).toBe(2);
    expect(state.items.map((item) => item.name)).toEqual(["milk", "eggs"]);
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

  it("doesn't flag an end in the same minute as a start that kept its seconds", () => {
    expect(outageTimeProblem({ ...EMPTY.outage, start: "2026-10-04T10:00:45Z", end: "2026-10-04T10:00:00Z" }, now)).toEqual({});
    expect(outageTimeProblem({ ...EMPTY.outage, start: "2026-10-04T10:00:45Z", end: "2026-10-04T09:59:00Z" }, now).end).toMatch(/before/);
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

  it("drops a confused answer's cut and opened flags, so frozen fruit moved to the fridge stays cut fruit", () => {
    const [item] = cleanItems({ items: [{ name: "bag of mango chunks", place: "fridge", row: "f-fruit", cut: false, opened: true, sure: true }] }, "fridge");
    expect(item).toMatchObject({ row: "r-fruit-cut", cut: null, opened: null, sure: false });
  });
});
