import { describe, expect, it } from "vitest";
import { cleanItems, INSTRUCTIONS, outputText, SCHEMA } from "../worker/recognize";
import { FREEZER_ROWS, FRIDGE_ROWS } from "../src/chart";

describe("checking the model's answer", () => {
  it("keeps good items as they are", () => {
    const items = cleanItems({ items: [
      { name: "bag of shredded cheese", place: "fridge", row: "r-shredded-cheese", cut: null, opened: true, sure: true },
      { name: "tub of ice cream", place: "freezer", row: "f-ice-cream", cut: null, opened: null, sure: true },
    ] });
    expect(items).toEqual([
      { name: "bag of shredded cheese", place: "fridge", row: "r-shredded-cheese", cut: null, opened: true, sure: true },
      { name: "tub of ice cream", place: "freezer", row: "f-ice-cream", cut: null, opened: null, sure: true },
    ]);
  });

  it("turns unknown rows into null and marks them unsure", () => {
    const [item] = cleanItems({ items: [{ name: "hummus", place: "fridge", row: "r-hummus", cut: null, opened: true, sure: true }] });
    expect(item.row).toBeNull();
    expect(item.sure).toBe(false);
  });

  it("moves a row from the other appliance's chart to its partner", () => {
    const [item] = cleanItems({ items: [{ name: "frozen milk", place: "freezer", row: "r-milk", cut: null, opened: null, sure: true }] });
    expect(item.row).toBe("f-milk");
  });

  it("drops nameless entries, fixes bad places and flags, and caps the list at 60", () => {
    const items = cleanItems({ items: [
      { name: "  ", place: "fridge", row: "r-milk" },
      { name: "eggs", place: "garage", row: "r-eggs", cut: "yes", opened: 1, sure: "true" },
      ...Array.from({ length: 80 }, (_, i) => ({ name: `item ${i}`, place: "fridge", row: null, cut: null, opened: null, sure: false })),
    ] });
    expect(items[0]).toEqual({ name: "eggs", place: "fridge", row: "r-eggs", cut: null, opened: null, sure: false });
    expect(items).toHaveLength(60);
  });

  it("rejects an answer with no list", () => {
    expect(() => cleanItems({ foods: [] })).toThrow();
    expect(() => cleanItems(null)).toThrow();
  });

  it("reads the text out of a Responses API result", () => {
    const data = { output: [
      { type: "reasoning", summary: [] },
      { type: "message", content: [{ type: "output_text", text: "{\"items\":" }, { type: "output_text", text: "[]}" }] },
    ] };
    expect(outputText(data)).toBe("{\"items\":[]}");
  });
});

describe("what the model is told", () => {
  it("lists every chart row id and asks it never to judge safety", () => {
    for (const row of [...FRIDGE_ROWS, ...FREEZER_ROWS]) expect(INSTRUCTIONS).toContain(`${row.id}: ${row.label}`);
    expect(INSTRUCTIONS).toMatch(/never say whether food is safe/);
  });

  it("uses a strict schema with every field required", () => {
    expect(SCHEMA.properties.items.items.required).toEqual(["name", "place", "row", "cut", "opened", "sure"]);
  });
});
