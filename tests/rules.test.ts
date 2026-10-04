import { describe, expect, it } from "vitest";
import { FREEZER_ROWS, FRIDGE_ROWS, ROWS, rowById, searchRows } from "../src/chart";
import { effectiveRow, moveRow, verdict, type Item, type Outage } from "../src/rules";

const START = Date.parse("2026-10-04T14:00:00-07:00");
const NOW = START + 200 * 3_600_000; // the outages below have all ended by now
const hoursLater = (h: number) => new Date(START + h * 3_600_000).toISOString();

function outage(hours: number, extra: Partial<Outage> = {}): Outage {
  return { start: new Date(START).toISOString(), end: hoursLater(hours), freezerFill: "half", doorClosed: true,
    fridgeTempF: null, freezerTempF: null, ...extra };
}

function item(row: string | null, extra: Partial<Item> = {}): Item {
  const place = rowById(row)?.place ?? "fridge";
  return { id: row ?? "x", name: row ?? "mystery", place, row, cut: null, opened: null, ice: false, sure: true, confirmed: true,
    from: "hand", cleared: false, ...extra };
}

const judge = (it: Item, out: Outage, now = NOW) => verdict(it, out, now);

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

  it("sends unqualified words to the chart's opened rows, not the app's sealed ones", () => {
    expect(searchRows("fridge", "baby formula")[0].id).toBe("r-formula");
    expect(searchRows("fridge", "canned tuna")[0].id).toBe("r-canned-meat");
  });

  it("doesn't call any block of cheese a hard cheese (Monterey Jack and Edam are soft on the chart)", () => {
    expect(searchRows("fridge", "block of cheese")[0]?.id).not.toBe("r-hard-cheese");
    expect(searchRows("fridge", "gouda")[0]?.id).not.toBe("r-hard-cheese");
  });
});

describe("fridge verdicts", () => {
  const expected = { discard: "toss", keep: "keep", "discard-above-50f-8h": "keep", sealed: "check" } as const;

  it("reads the chart for every row after a 7.5-hour outage with the door closed", () => {
    for (const row of FRIDGE_ROWS) {
      expect(judge(item(row.id), outage(7.5)).call, row.id).toBe(expected[row.rule]);
    }
  });

  it("keeps everything for 4 hours with the door closed, and 2 hours otherwise", () => {
    for (const row of FRIDGE_ROWS.filter((r) => r.rule === "discard")) {
      expect(judge(item(row.id), outage(4)).call).toBe("keep");
      expect(judge(item(row.id), outage(2, { doorClosed: false })).call).toBe("keep");
      expect(judge(item(row.id), outage(3, { doorClosed: false })).call).toBe("toss");
    }
  });

  it("discards perishables after 4 hours even if the fridge reads 40°F or below (a reading only makes it stricter)", () => {
    for (const row of FRIDGE_ROWS.filter((r) => r.rule === "discard")) {
      expect(judge(item(row.id), outage(12, { fridgeTempF: 39 })).call, row.id).toBe("toss");
      expect(judge(item(row.id), outage(12, { fridgeTempF: 40 })).call, row.id).toBe("toss");
    }
  });

  it("uses the 2-hour threshold when a thermometer shows the fridge got warm", () => {
    expect(judge(item("r-milk"), outage(3, { fridgeTempF: 45 })).call).toBe("toss");
    expect(judge(item("r-milk"), outage(2, { fridgeTempF: 45 })).call).toBe("keep");
  });

  it("applies the 50°F / 8-hour rule to opened mayonnaise", () => {
    expect(judge(item("r-mayo"), outage(9)).call).toBe("check");
    expect(judge(item("r-mayo"), outage(9, { fridgeTempF: 48 })).call).toBe("keep");
    expect(judge(item("r-mayo"), outage(9, { fridgeTempF: 55 })).call).toBe("toss");
    expect(judge(item("r-mayo"), outage(6)).call).toBe("keep");
  });

  it("follows the cut and opened flags to the right row", () => {
    expect(effectiveRow(item("r-fruit-cut", { cut: false }))?.id).toBe("r-fruit-whole");
    expect(judge(item("r-fruit-cut", { cut: false }), outage(7.5)).call).toBe("keep");
    expect(judge(item("r-fruit-whole", { cut: true }), outage(7.5)).call).toBe("toss");
    expect(judge(item("r-mayo", { opened: false }), outage(9)).call).toBe("check");
    expect(judge(item("r-juice", { opened: false }), outage(9)).call).toBe("keep");
    expect(judge(item("r-pasta-sauce", { opened: false }), outage(9)).why).toMatch(/Sealed/);
  });

  it("matches the PRD example: shredded cheese tossed, the cheddar block kept, each with its row", () => {
    const shredded = judge(item("r-shredded-cheese"), outage(7.5));
    const block = judge(item("r-hard-cheese"), outage(7.5));
    expect(shredded.call).toBe("toss");
    expect(shredded.row?.label).toBe("Shredded cheeses");
    expect(block.call).toBe("keep");
    expect(block.row?.label).toMatch(/^Hard cheeses: Cheddar/);
    expect(shredded.why).toMatch(/7 h 30 min/);
    expect(shredded.column).toBe("Exposed to 40°F (4°C) or above for more than 2 hours");
  });
});

describe("freezer verdicts", () => {
  it("keeps everything while the freezer holds with the door closed: 24 hours half full, 48 full", () => {
    for (const row of FREEZER_ROWS) {
      expect(judge(item(row.id), outage(24)).call, row.id).toBe("keep");
      expect(judge(item(row.id), outage(30, { freezerFill: "full" })).call, row.id).toBe("keep");
    }
  });

  it("doesn't count on a hold time when the fill is unknown, less than half, or the door was opened", () => {
    for (const extra of [{ freezerFill: "unknown" }, { freezerFill: "low" }, { doorClosed: false }] as Partial<Outage>[]) {
      for (const row of FREEZER_ROWS) {
        const v = judge(item(row.id), outage(10, extra));
        expect(v.call, `${row.id} ${JSON.stringify(extra)}`).toBe("check");
        expect(v.why).toMatch(/ice crystals/);
      }
    }
    expect(judge(item("f-meat"), outage(49, { freezerFill: "unknown" })).call).toBe("toss");
    expect(judge(item("f-meat", { ice: true }), outage(10, { doorClosed: false })).call).toBe("refreeze");
  });

  it("reads the ice-crystal column for food that still has ice crystals or reads 40°F or below", () => {
    const calls = { refreeze: "refreeze", discard: "toss" } as const;
    for (const row of FREEZER_ROWS) {
      const call = calls[row.ice as "refreeze" | "discard"];
      expect(judge(item(row.id, { ice: true }), outage(30)).call, row.id).toBe(call);
      expect(judge(item(row.id), outage(30, { freezerTempF: 38 })).call, row.id).toBe(call);
    }
  });

  it("keeps food in a freezer still at 0°F or below", () => {
    for (const row of FREEZER_ROWS) expect(judge(item(row.id), outage(30, { freezerTempF: 0 })).call, row.id).toBe("keep");
  });

  it("tosses ice cream that has ice crystals, even inside the hold time (the chart discards it in both columns)", () => {
    expect(judge(item("f-ice-cream", { ice: true }), outage(10)).call).toBe("toss");
    expect(judge(item("f-ice-cream", { ice: true }), outage(30)).call).toBe("toss");
  });

  it("refreezes only with ice crystals: feeling cold is not enough", () => {
    expect(judge(item("f-meat"), outage(36)).call).toBe("toss");
    expect(judge(item("f-meat", { ice: true }), outage(36)).call).toBe("refreeze");
  });

  it("reads the warm column for food past the hold time with no ice crystals marked", () => {
    for (const row of FREEZER_ROWS) {
      const v = judge(item(row.id), outage(28));
      if (row.warm === "discard") expect(v.call, row.id).toBe("toss");
      if (row.warm === "refreeze") expect(v.call, row.id).toBe("refreeze");
      if (row.warm === "discard-after-6h") expect(v.call, row.id).toBe("check");
      expect(v.why, row.id).toMatch(/no ice crystals marked|discards it after 6 hours/);
    }
    expect(judge(item("f-veg"), outage(31)).call).toBe("toss");
  });
});

describe("items and outages the app can't judge", () => {
  it("sends items the chart can't place to Check, never Keep", () => {
    expect(judge(item(null), outage(1)).call).toBe("check");
    expect(judge(item("r-milk", { place: "freezer" }), outage(1)).call).toBe("check");
  });

  it("asks for the outage start before judging", () => {
    expect(judge(item("r-milk"), { ...outage(5), start: null }).call).toBe("check");
  });

  it("sends everything to Check when the times don't add up, instead of counting 0 hours", () => {
    const backwards = { ...outage(5), end: new Date(START - 12 * 3_600_000).toISOString() };
    for (const row of ["r-meat", "f-meat", "r-hard-cheese"]) {
      const v = judge(item(row), backwards);
      expect(v.call, row).toBe("check");
      expect(v.why).toMatch(/don't add up/);
    }
    const future = outage(5, { start: new Date(NOW + 3 * 3_600_000).toISOString(), end: null });
    expect(judge(item("r-hard-cheese"), future).call).toBe("check");
  });
});

describe("the AI's matches", () => {
  const match = (row: string, extra: Partial<Item> = {}) =>
    item(row, { name: "container of grapes", from: "photo", sure: true, confirmed: false, ...extra });

  it("never keep or refreeze until the person confirms them, even when the AI was sure", () => {
    const sure = judge(match("r-fruit-whole"), outage(7.5));
    expect(sure).toMatchObject({ call: "check", pending: "keep" });
    expect(sure.why).toMatch(/Photos can fool the AI\. If this is “container of grapes”, the chart says keep/);
    expect(judge(match("r-veg-whole", { sure: false }), outage(7.5)).why).toMatch(/wasn't sure/);
    expect(judge(match("r-hard-cheese"), outage(7.5)).why).toMatch(/look alike.*“Hard cheeses/);
    expect(judge(match("f-meat", { ice: true }), outage(30))).toMatchObject({ call: "check", pending: "refreeze" });
    expect(judge(match("r-fruit-whole"), outage(1))).toMatchObject({ call: "check", pending: "keep" });
  });

  it("keep once confirmed, and items added by hand need no confirming", () => {
    expect(judge(match("r-fruit-whole", { confirmed: true }), outage(7.5)).call).toBe("keep");
    expect(judge(match("f-meat", { ice: true, confirmed: true }), outage(30)).call).toBe("refreeze");
    expect(judge(item("r-fruit-whole"), outage(7.5)).pending).toBeUndefined();
  });

  it("still toss or check outright when the matched row says so", () => {
    const milk = judge(match("r-milk"), outage(7.5));
    expect(milk.call).toBe("toss");
    expect(milk.pending).toBeUndefined();
    expect(judge(match("r-mayo"), outage(9)).call).toBe("check");
  });
});

describe("fixing an item", () => {
  it("moves its row to the other appliance's chart", () => {
    expect(moveRow("r-milk")).toBe("f-milk");
    expect(moveRow("f-meat")).toBe("r-meat");
    expect(moveRow("r-condiments")).toBeNull();
  });

  it("moves frozen fruit to the fridge as cut fruit, and fresh pasta and dough to no freezer row", () => {
    expect(moveRow("f-fruit")).toBe("r-fruit-cut");
    expect(moveRow("r-fresh-pasta")).toBeNull();
    expect(moveRow("r-dough")).toBeNull();
  });

  it("re-judges milk moved to a freezer past its hold time: Refreeze with ice crystals, Toss without", () => {
    expect(judge(item("f-milk", { ice: true }), outage(30)).call).toBe("refreeze");
    expect(judge(item("f-milk"), outage(30)).call).toBe("toss");
  });

  it("turns cut melon into a whole melon: Toss becomes Keep", () => {
    const melon = item("r-fruit-cut", { cut: true });
    expect(judge(melon, outage(7.5)).call).toBe("toss");
    expect(judge({ ...melon, cut: false }, outage(7.5)).call).toBe("keep");
  });
});
