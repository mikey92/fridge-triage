// Time helpers for the cold clock and the outage form.
import { useEffect, useState } from "react";
import { freezerHoldHours, fridgeSafeHours, outageSpan, type Outage } from "./rules";

const HOUR = 3_600_000;

export type Clock = {
  outMs: number; // how long the power has been (or was) out
  fridgeHours: number; // 4 with the doors closed, 2 if they were opened a lot or the fridge read 40°F or above
  fridgeLeftMs: number; // negative once past them
  freezerLeftMs: number | null; // null with no hold time to count down: less than half full, or the door opened
  freezerHold: number | null; // hours
  running: boolean; // the power is still out
};

/** The countdowns, on the same terms as the verdicts (rules.ts); null when the times don't add up. */
export function coldClock(outage: Outage, now: number): Clock | null {
  const span = outageSpan(outage, now);
  if (!span) return null;
  const outMs = span.end - span.start;
  const fridgeHours = fridgeSafeHours(outage);
  // "Not sure" counts down the half-full figure, labeled as such; the verdicts don't count on it.
  const freezerHold = outage.doorClosed ? freezerHoldHours(outage.freezerFill) : null;
  return {
    outMs,
    fridgeHours,
    fridgeLeftMs: fridgeHours * HOUR - outMs,
    freezerLeftMs: freezerHold === null ? null : freezerHold * HOUR - outMs,
    freezerHold,
    running: !outage.end,
  };
}

/** "3:12:05" for a countdown; hours can exceed 24. */
export function hms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Value for <input type="datetime-local"> in the viewer's time zone; empty for a time the field can't show. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  const year = local.getUTCFullYear(); // NaN for a time that isn't one
  return year >= 1000 && year <= 9999 ? local.toISOString().slice(0, 16) : "";
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const time = new Date(value).getTime(); // parsed as local time
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/** The current time, refreshed every `everyMs` while the component is mounted. */
export function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
