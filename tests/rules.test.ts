import { describe, expect, it } from "vitest";
import { FREEZER_ROWS, FRIDGE_ROWS, ROWS, rowById, searchRows } from "../src/chart";
import { effectiveRow, moveRow, verdict, type Item, type Outage } from "../src/rules";

const START = Date.parse("2026-10-04T14:00:00-07:00");
const hoursLater = (h: number) => new Date(START + h * 3_600_000).toISOString();

function outage(hours: number, extra: Partial<Outage> = {}): Outage {
  return { start: new Date(START).toISOString(), end: hoursLater(hours), freezerFill: "half", doorClosed: true,
    fridgeTempF: null, freezerTempF: null, ...extra };
}

function item(row: string | null, extra: Partial<Item> = {}): Item {
  const place = rowById(row)?.place ?? "fridge";
  return { id: row ?? "x", name: row ?? "mystery", place, row, cut: null, opened: null, ice: false, sure: true, from: "hand",
    cleared: false, ...extra };
}

describe("the chart data", () => {
  it("has unique ids and both charts complete", () => {
    expect(new Set(ROWS.map((r) => r.id)).size).toBe(ROWS.length);
    expect(FRIDGE_ROWS.filter((r) => r.onChart)).toHaveLength(54);
    expect(FREEZER_ROWS).toHaveLength(20);
  });

  it("links every cut/opened twin both ways, in the same appliance, with opposite states", () => {
    for (const row of ROWS.filter((r) => r.twin)) {
      const twin = rowById(row.twin)!;
      expect(twin, row.id).toBeDefined();
      expect(twin.twin).toBe(row.id);
      expect(twin.place).toBe(row.place);
      if (row.cut !== undefined) expect(twin.cut).toBe(!row.cut);
      if (row.opened !== undefined) expect(twin.opened).toBe(!row.opened);
    }
  });

  it("moves only to rows of the other appliance", () => {
    for (const row of ROWS.filter((r) => r.move)) {
      const other = rowById(row.move)!;
      expect(other, row.id).toBeDefined();
      expect(other.place).not.toBe(row.place);
    }
  });

  it("finds rows by everyday words", () => {
    expect(searchRows("fridge", "yogurt")[0].id).toBe("r-milk");
    expect(searchRows("fridge", "shredded cheese")[0].id).toBe("r-shredded-cheese");
    expect(searchRows("freezer", "ice cream")[0].id).toBe("f-ice-cream");
    expect(searchRows("fridge", "cheddar")[0].id).toBe("r-hard-cheese");
  });
});

describe("fridge verdicts", () => {
  const expected = { discard: "toss", keep: "keep", "discard-above-50f-8h": "keep", sealed: "check" } as const;

  it("reads the chart for every row after a 7.5-hour outage with the door closed", () => {
    for (const row of FRIDGE_ROWS) {
      expect(verdict(item(row.id), outage(7.5)).call, row.id).toBe(expected[row.rule]);
    }
  });

  it("keeps everything for 4 hours with the door closed, and 2 hours otherwise", () => {
    for (const row of FRIDGE_ROWS.filter((r) => r.rule === "discard")) {
      expect(verdict(item(row.id), outage(4)).call).toBe("keep");
      expect(verdict(item(row.id), outage(2, { doorClosed: false })).call).toBe("keep");
      expect(verdict(item(row.id), outage(3, { doorClosed: false })).call).toBe("toss");
    }
  });

  it("keeps everything when the fridge never passed 40°F", () => {
    for (const row of FRIDGE_ROWS.filter((r) => r.rule === "discard")) {
      expect(verdict(item(row.id), outage(12, { fridgeTempF: 39 })).call).toBe("keep");
    }
  });

  it("uses the 2-hour threshold when a thermometer shows the fridge got warm", () => {
    expect(verdict(item("r-milk"), outage(3, { fridgeTempF: 45 })).call).toBe("toss");
  });

  it("applies the 50°F / 8-hour rule to opened mayonnaise", () => {
    expect(verdict(item("r-mayo"), outage(9)).call).toBe("check");
    expect(verdict(item("r-mayo"), outage(9, { fridgeTempF: 48 })).call).toBe("keep");
    expect(verdict(item("r-mayo"), outage(9, { fridgeTempF: 55 })).call).toBe("check");
    expect(verdict(item("r-mayo"), outage(6)).call).toBe("keep");
  });

  it("follows the cut and opened flags to the right row", () => {
    expect(effectiveRow(item("r-fruit-cut", { cut: false }))?.id).toBe("r-fruit-whole");
    expect(verdict(item("r-fruit-cut", { cut: false }), outage(7.5)).call).toBe("keep");
    expect(verdict(item("r-fruit-whole", { cut: true }), outage(7.5)).call).toBe("toss");
    expect(verdict(item("r-mayo", { opened: false }), outage(9)).call).toBe("check");
    expect(verdict(item("r-juice", { opened: false }), outage(9)).call).toBe("keep");
    expect(verdict(item("r-pasta-sauce", { opened: false }), outage(9)).why).toMatch(/Sealed/);
  });

  it("matches the PRD example: shredded cheese tossed, the cheddar block kept, each with its row", () => {
    const shredded = verdict(item("r-shredded-cheese"), outage(7.5));
    const block = verdict(item("r-hard-cheese"), outage(7.5));
    expect(shredded.call).toBe("toss");
    expect(shredded.row?.label).toBe("Shredded cheeses");
    expect(block.call).toBe("keep");
    expect(block.row?.label).toMatch(/^Hard cheeses: Cheddar/);
    expect(shredded.why).toMatch(/7 h 30 min/);
  });
});

describe("freezer verdicts", () => {
  it("keeps everything while the freezer holds: 24 hours half full or unsure, 48 full", () => {
    for (const row of FREEZER_ROWS) {
      expect(verdict(item(row.id), outage(24)).call).toBe("keep");
      expect(verdict(item(row.id), outage(30, { freezerFill: "full" })).call).toBe("keep");
    }
    expect(verdict(item("f-meat"), outage(25, { freezerFill: "unknown" })).call).toBe("toss");
  });

  it("reads the ice-crystal column for food that is still cold", () => {
    const calls = { refreeze: "refreeze", discard: "toss" } as const;
    for (const row of FREEZER_ROWS) {
      const call = calls[row.ice as "refreeze" | "discard"];
      expect(verdict(item(row.id, { ice: true }), outage(30)).call, row.id).toBe(call);
      expect(verdict(item(row.id), outage(30, { freezerTempF: 38 })).call, row.id).toBe(call);
    }
  });

  it("reads the warm column for food past the hold time with no ice crystals", () => {
    for (const row of FREEZER_ROWS) {
      const call = verdict(item(row.id), outage(28)).call;
      if (row.warm === "discard") expect(call, row.id).toBe("toss");
      if (row.warm === "refreeze") expect(call, row.id).toBe("refreeze");
      if (row.warm === "discard-after-6h") expect(call, row.id).toBe("check");
    }
    expect(verdict(item("f-veg"), outage(31)).call).toBe("toss");
  });

  it("tosses ice cream past the hold time even with ice crystals (the chart discards it either way)", () => {
    expect(verdict(item("f-ice-cream", { ice: true }), outage(30)).call).toBe("toss");
  });
});

describe("items the chart can't place", () => {
  it("sends them to Check, never Keep", () => {
    expect(verdict(item(null), outage(1)).call).toBe("check");
    expect(verdict(item("r-milk", { place: "freezer" }), outage(1)).call).toBe("check");
  });

  it("asks for the outage start before judging", () => {
    expect(verdict(item("r-milk"), { ...outage(5), start: null }).call).toBe("check");
  });
});

describe("fixing an item", () => {
  it("moves its row to the other appliance's chart", () => {
    expect(moveRow("r-milk")).toBe("f-milk");
    expect(moveRow("f-meat")).toBe("r-meat");
    expect(moveRow("r-condiments")).toBeNull();
  });

  it("re-judges milk moved to a freezer past its hold time: Refreeze with ice crystals, Toss without", () => {
    expect(verdict(item("f-milk", { ice: true }), outage(30)).call).toBe("refreeze");
    expect(verdict(item("f-milk"), outage(30)).call).toBe("toss");
  });

  it("turns cut melon into a whole melon: Toss becomes Keep", () => {
    const melon = item("r-fruit-cut", { cut: true });
    expect(verdict(melon, outage(7.5)).call).toBe("toss");
    expect(verdict({ ...melon, cut: false }, outage(7.5)).call).toBe("keep");
  });
});
