// The verdicts. They come only from the chart rows (chart.ts) and the outage facts; nothing here calls the AI.
// USDA: a closed fridge keeps food safe for about 4 hours; a full freezer holds about 48 hours (24 if half full).
// The refrigerated chart applies to food above 40°F for more than 2 hours. When in doubt, throw it out.
import { rowById, type FreezerRow, type FridgeRow, type Place, type Row } from "./chart";

export type Call = "toss" | "check" | "refreeze" | "keep";
export const CALL_ORDER: Call[] = ["toss", "check", "refreeze", "keep"];

export type Outage = {
  start: string | null; // ISO time the power went out
  end: string | null; // ISO time it came back; null while out
  freezerFill: "full" | "half" | "unknown";
  doorClosed: boolean; // the fridge door stayed mostly closed
  fridgeTempF: number | null; // fridge thermometer when the power came back (its warmest point)
  freezerTempF: number | null;
};

export type Item = {
  id: string;
  name: string;
  place: Place;
  row: string | null;
  cut: boolean | null;
  opened: boolean | null;
  ice: boolean; // freezer item still has ice crystals or feels as cold as the fridge
  sure: boolean;
  from: "photo" | "hand";
  cleared: boolean;
};

export type Verdict = {
  call: Call;
  why: string; // the condition that decided it, in plain words
  row?: Row;
  column?: string; // which chart column was read
};

const HOUR = 3_600_000;
export const FRIDGE_HOURS_DOOR_CLOSED = 4;
export const FRIDGE_HOURS_OTHERWISE = 2;
const WARM_COLUMN = "Above 40°F for more than 2 hours";
const ICE_COLUMN = "Contains ice crystals and feels cold as if refrigerated";

export function freezerHoldHours(fill: Outage["freezerFill"]): number {
  return fill === "full" ? 48 : 24; // "not sure" is treated as half full
}

export function outageHours(outage: Outage, now: number): number | null {
  if (!outage.start) return null;
  const end = outage.end ? Date.parse(outage.end) : now;
  return Math.max(0, (end - Date.parse(outage.start)) / HOUR);
}

export function formatHours(hours: number): string {
  const minutes = Math.round(hours * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The row an item is judged by: its own row, or the chart's row for its cut/opened state when the chart splits them. */
export function effectiveRow(item: Item): Row | undefined {
  const row = rowById(item.row);
  if (!row || row.place !== item.place) return undefined;
  const twin = rowById(row.twin);
  if (twin && item.cut !== null && row.cut !== undefined && row.cut !== item.cut) return twin;
  if (twin && item.opened !== null && row.opened !== undefined && row.opened !== item.opened) return twin;
  return row;
}

export function verdict(item: Item, outage: Outage, now: number = Date.now()): Verdict {
  const row = effectiveRow(item);
  if (!row) {
    return { call: "check", why: "Not matched to a row of the FoodSafety.gov chart. When in doubt, throw it out." };
  }
  const hours = outageHours(outage, now);
  if (hours === null) return { call: "check", why: "Add when the power went out to get a verdict.", row };
  return row.place === "fridge" ? fridgeVerdict(row, outage, hours) : freezerVerdict(row, item, outage, hours);
}

function fridgeVerdict(row: FridgeRow, outage: Outage, hours: number): Verdict {
  const temp = outage.fridgeTempF;
  if (temp !== null && temp <= 40) {
    return { call: "keep", row, why: `Your fridge was at ${temp}°F when the power came back, so it never passed 40°F.` };
  }
  const safeHours = outage.doorClosed && temp === null ? FRIDGE_HOURS_DOOR_CLOSED : FRIDGE_HOURS_OTHERWISE;
  if (hours <= safeHours) {
    const how = safeHours === FRIDGE_HOURS_DOOR_CLOSED
      ? "a closed fridge keeps food safe for up to 4 hours"
      : "food has to be above 40°F for more than 2 hours before the chart applies";
    return { call: "keep", row, why: `Power out ${formatHours(hours)}: ${how}.` };
  }
  const out = `Power out ${formatHours(hours)}`;
  const column = WARM_COLUMN;
  switch (row.rule) {
    case "discard":
      return { call: "toss", row, column, why: `${out}. The chart says discard.` };
    case "keep":
      return { call: "keep", row, column, why: row.note ?? `${out}. The chart says keep.` };
    case "discard-above-50f-8h":
      if (temp !== null && temp <= 50) {
        return { call: "keep", row, column, why: `The chart discards it only above 50°F for more than 8 hours; your fridge peaked at ${temp}°F.` };
      }
      if (hours <= 8) {
        return { call: "keep", row, column, why: `The chart discards it only above 50°F for more than 8 hours; the power was out ${formatHours(hours)}.` };
      }
      return { call: "check", row, column,
        why: `${out}. Toss it if it was above 50°F for more than 8 hours. When in doubt, throw it out.` };
    case "sealed":
      return { call: "check", row,
        why: "Sealed: keep it only if it was sold unrefrigerated and the label doesn't say Keep Refrigerated. Otherwise toss it." };
  }
}

function freezerVerdict(row: FreezerRow, item: Item, outage: Outage, hours: number): Verdict {
  const hold = freezerHoldHours(outage.freezerFill);
  const temp = outage.freezerTempF;
  const fill = outage.freezerFill === "full" ? "a full freezer" : outage.freezerFill === "half" ? "a half-full freezer" : "a freezer (treated as half full)";
  if (temp === null && hours <= hold) {
    return { call: "keep", row, why: `Power out ${formatHours(hours)}: ${fill} holds a safe temperature for about ${hold} hours.` };
  }
  const cold = item.ice || (temp !== null && temp <= 40);
  if (cold) {
    const why = item.ice ? "It still has ice crystals or feels as cold as the fridge." : `Your freezer was at ${temp}°F.`;
    return row.ice === "discard"
      ? { call: "toss", row, column: ICE_COLUMN, why: `${why} The chart discards it even so.` }
      : { call: "refreeze", row, column: ICE_COLUMN, why: `${why} Safe to refreeze.${row.iceNote ? ` ${row.iceNote}` : ""}` };
  }
  const out = temp !== null && temp > 40 ? `Your freezer was at ${temp}°F` : `Power out ${formatHours(hours)}, past the ${hold} hours ${fill} holds`;
  switch (row.warm) {
    case "discard":
      return { call: "toss", row, column: WARM_COLUMN, why: `${out}, and no ice crystals left. The chart says discard.` };
    case "refreeze":
      return { call: "refreeze", row, column: WARM_COLUMN, why: `${out}. The chart says it can be refrozen.${row.warmNote ? ` ${row.warmNote}` : ""}` };
    case "discard-after-6h": {
      const pastHold = hours - hold;
      return pastHold >= 6
        ? { call: "toss", row, column: WARM_COLUMN,
          why: `Power out ${formatHours(hours)}, ${formatHours(pastHold)} past the ${hold} hours ${fill} holds. The chart discards it after 6 hours above 40°F.` }
        : { call: "check", row, column: WARM_COLUMN,
          why: `${out}. The chart discards it after 6 hours above 40°F: refreeze only if it has been warm for less than that.` };
    }
  }
}

/** A freezer row's companion in the fridge chart and back, for moving an item between appliances. */
export function moveRow(rowId: string | null): string | null {
  return rowById(rowId)?.move ?? null;
}
