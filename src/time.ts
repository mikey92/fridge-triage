// Time helpers for the cold clock and the outage form.
import { useEffect, useState } from "react";
import { FRIDGE_HOURS_DOOR_CLOSED, freezerHoldHours, type Outage } from "./rules";

const HOUR = 3_600_000;

export type Clock = {
  outMs: number; // how long the power has been (or was) out
  fridgeLeftMs: number; // negative once past the 4 hours
  freezerLeftMs: number | null; // null when the freezer is less than half full: no hold time to count down
  freezerHold: number | null; // hours
  running: boolean; // the power is still out
};

export function coldClock(outage: Outage, now: number): Clock | null {
  if (!outage.start) return null;
  const start = Date.parse(outage.start);
  const end = outage.end ? Date.parse(outage.end) : now;
  // Times that don't add up get no clock; the screens say so instead (see outageHours in rules.ts).
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || start > now + 5 * 60_000) return null;
  const outMs = end - start;
  const freezerHold = freezerHoldHours(outage.freezerFill);
  return {
    outMs,
    fridgeLeftMs: FRIDGE_HOURS_DOOR_CLOSED * HOUR - outMs,
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

/** Value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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
