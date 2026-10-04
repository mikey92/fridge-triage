// The verdicts. They come only from the chart rows (chart.ts) and the outage facts; nothing here calls the AI.
// FoodSafety.gov: a fridge keeps food safe for up to 4 hours with the door closed; discard refrigerated perishables
// after 4 hours without power. A full freezer holds about 48 hours (24 if half full and the door stays closed);
// frozen food may be refrozen if it still has ice crystals or is at 40°F or below. When in doubt, throw it out.
import { rowById, type FreezerRow, type FridgeRow, type Place, type Row } from "./chart";

export type Call = "toss" | "check" | "refreeze" | "keep";
export const CALL_ORDER: Call[] = ["toss", "check", "refreeze", "keep"];

export type Outage = {
  start: string | null; // ISO time the power went out
  end: string | null; // ISO time it came back; null while out
  freezerFill: "full" | "half" | "low" | "unknown"; // low: less than half full
  doorClosed: boolean; // the fridge and freezer doors stayed mostly closed
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
  ice: boolean; // freezer item still has ice crystals
  sure: boolean; // the AI's own confidence in the row (true for items added by hand)
  confirmed: boolean; // the person confirmed the AI's match or picked the row; items added by hand start confirmed
  from: "photo" | "hand";
  cleared: boolean;
};

export type Verdict = {
  call: Call;
  why: string; // the condition that decided it, in plain words
  row?: Row;
  column?: string; // which chart column was read
  pending?: "keep" | "refreeze"; // the call once the person confirms the AI's match (the call itself is check)
};

const HOUR = 3_600_000;
const GRACE = 5 * 60_000; // clocks a few minutes apart are not an error
export const FRIDGE_HOURS_DOOR_CLOSED = 4;
export const FRIDGE_HOURS_OTHERWISE = 2;
const WARM_COLUMN = "Exposed to 40°F (4°C) or above for more than 2 hours";
const ICE_COLUMN = "Contains ice crystals and feels cold as if refrigerated";

/** Hours a freezer holds a safe temperature with its door closed: 48 full, 24 half full. None when less than half full.
 * "Not sure" shows the half-full figure on the clock, but the verdicts don't count on it. */
export function freezerHoldHours(fill: Outage["freezerFill"]): number | null {
  return fill === "full" ? 48 : fill === "low" ? null : 24;
}

/** The hold time a verdict may rely on: only when the fill is known and the doors stayed mostly closed. */
function countedHold(outage: Outage): number | null {
  if (!outage.doorClosed || (outage.freezerFill !== "full" && outage.freezerFill !== "half")) return null;
  return freezerHoldHours(outage.freezerFill);
}

/** Hours without power, or null when the times are missing or don't add up (back before it went out, or in the future). */
export function outageHours(outage: Outage, now: number): number | null {
  if (!outage.start) return null;
  const start = Date.parse(outage.start);
  // While the power is still out, a screen clock that ticked just before the start is not an error: 0 hours so far.
  const end = outage.end ? Date.parse(outage.end) : Math.max(now, start);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || start > now + GRACE || end > now + GRACE) return null;
  return (end - start) / HOUR;
}

export function formatHours(hours: number): string {
  // Rounded up, so a time just past a limit never reads as the limit itself ("4 h 1 min", not "4 h").
  const minutes = Math.ceil(hours * 60 - 1e-9);
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

/** True for an AI match the person hasn't confirmed yet. Until then it can't keep or refreeze anything. */
export function unconfirmed(item: Item): boolean {
  return item.from === "photo" && !item.confirmed && !!item.row;
}

export function verdict(item: Item, outage: Outage, now: number = Date.now()): Verdict {
  const row = effectiveRow(item);
  if (!row) {
    return { call: "check", why: "Not matched to a row of the FoodSafety.gov chart. When in doubt, throw it out." };
  }
  const hours = outageHours(outage, now);
  if (hours === null) {
    return { call: "check", row,
      why: outage.start ? "The outage times don't add up. Fix them to get a verdict." : "Add when the power went out to get a verdict." };
  }
  const decided = row.place === "fridge" ? fridgeVerdict(row, outage, hours) : freezerVerdict(row, item, outage, hours);
  // The AI's match never keeps food on its own: a photo can make peas look like grapes. Until the person confirms
  // the match, Keep and Refreeze become Check, with the call they will get once confirmed.
  if (unconfirmed(item) && (decided.call === "keep" || decided.call === "refreeze")) {
    const doubt = row.lookAlike
      ? "Cheeses and spreads look alike in photos, and the chart keeps some and throws others out."
      : item.sure ? "Photos can fool the AI." : "The AI wasn't sure what this is.";
    const what = row.lookAlike ? `“${row.label}”` : `“${item.name}”`;
    return { ...decided, call: "check", pending: decided.call,
      why: `${doubt} If this is ${what}, the chart says ${decided.call}: confirm it, or fix the match.` };
  }
  return decided;
}

function fridgeVerdict(row: FridgeRow, outage: Outage, hours: number): Verdict {
  const temp = outage.fridgeTempF;
  const warmReading = temp !== null && temp > 40;
  // A reading only ever makes the call stricter: FoodSafety.gov discards perishables after 4 hours without power.
  const safeHours = outage.doorClosed && !warmReading ? FRIDGE_HOURS_DOOR_CLOSED : FRIDGE_HOURS_OTHERWISE;
  if (hours <= safeHours) {
    const how = safeHours === FRIDGE_HOURS_DOOR_CLOSED
      ? "a closed fridge keeps food safe for up to 4 hours"
      : warmReading
        ? `your fridge was at ${temp}°F, and the chart allows 2 hours at 40°F or above`
        : "with the door opened often, the app allows 2 hours, the chart's limit at 40°F or above";
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
      if (temp !== null) {
        return { call: "toss", row, column,
          why: `${out}, and your fridge was at ${temp}°F. The chart discards it above 50°F for more than 8 hours. When in doubt, throw it out.` };
      }
      return { call: "check", row, column,
        why: `${out}. Toss it if it was above 50°F for more than 8 hours. When in doubt, throw it out.` };
    case "sealed":
      return { call: "check", row,
        why: "Sealed: keep it only if it was sold unrefrigerated and the label doesn't say Keep Refrigerated. Otherwise toss it." };
  }
}

function freezerVerdict(row: FreezerRow, item: Item, outage: Outage, hours: number): Verdict {
  const temp = outage.freezerTempF;
  const hold = countedHold(outage);
  const fill = outage.freezerFill === "full" ? "a full freezer" : "a half-full freezer";

  // A freezer still at 0°F or below never warmed: nothing has thawed.
  if (temp !== null && temp <= 0) {
    return { call: "keep", row, why: `Your freezer was at ${temp}°F when the power came back: still frozen.` };
  }
  // Ice crystals, or a reading at 40°F or below: the chart's first column.
  if (item.ice || (temp !== null && temp <= 40)) {
    const why = item.ice ? "It still has ice crystals." : `Your freezer was at ${temp}°F when the power came back.`;
    return row.ice === "discard"
      ? { call: "toss", row, column: ICE_COLUMN, why: `${why} The chart discards it even so.` }
      : { call: "refreeze", row, column: ICE_COLUMN, why: `${why} Safe to refreeze.${row.iceNote ? ` ${row.iceNote}` : ""}` };
  }
  if (temp === null) {
    if (hold !== null && hours <= hold) {
      return { call: "keep", row, why: `Power out ${formatHours(hours)}: ${fill} holds a safe temperature for about ${hold} hours with the door closed.` };
    }
    if (hold === null && hours <= 48) {
      const reason = !outage.doorClosed ? "The freezer door was opened, so" : outage.freezerFill === "low" ? "The freezer was less than half full, so" : "Without knowing how full the freezer was,";
      return { call: "check", row,
        why: `${reason} the app can't count on a hold time. Feel it: if it still has ice crystals, mark it and the chart says ${row.ice === "discard" ? "discard" : "refreeze"}. If it has thawed, the chart says ${warmWord(row)}.` };
    }
  }
  // Thawed: a warm reading, or past the time the freezer holds with no ice crystals marked.
  const limit = hold ?? 48;
  const out = temp !== null ? `Your freezer was at ${temp}°F` : `Power out ${formatHours(hours)}, past the ${limit} hours ${hold !== null ? fill : "a full freezer"} holds, and no ice crystals marked`;
  switch (row.warm) {
    case "discard":
      return { call: "toss", row, column: WARM_COLUMN, why: `${out}. The chart says discard.` };
    case "refreeze":
      return { call: "refreeze", row, column: WARM_COLUMN, why: `${out}. The chart says it can be refrozen.${row.warmNote ? ` ${row.warmNote}` : ""}` };
    case "discard-after-6h": {
      const warmFor = hours - limit;
      return temp === null && warmFor >= 6
        ? { call: "toss", row, column: WARM_COLUMN,
          why: `Power out ${formatHours(hours)}, ${formatHours(warmFor)} past the ${limit} hours. The chart discards it after 6 hours above 40°F.` }
        : { call: "check", row, column: WARM_COLUMN,
          why: `${out}. The chart discards it after 6 hours above 40°F: refreeze only if it has been warm for less than that.` };
    }
  }
}

function warmWord(row: FreezerRow): string {
  return row.warm === "refreeze" ? "it can still be refrozen" : row.warm === "discard" ? "discard" : "discard after 6 hours above 40°F";
}

/** A freezer row's companion in the fridge chart and back, for moving an item between appliances. */
export function moveRow(rowId: string | null): string | null {
  return rowById(rowId)?.move ?? null;
}
