import type { Outage } from "../rules";
import { formatHours, FRIDGE_HOURS_DOOR_CLOSED } from "../rules";
import { coldClock, formatClockTime, hms, useNow } from "../time";

/** Two countdowns while the power is out: fridge 4 hours (2 with the doors opened a lot), freezer 24 or 48. */
export function ColdClock({ outage }: { outage: Outage }) {
  const now = useNow(1000);
  const clock = coldClock(outage, now);
  if (!outage.start) return null;
  if (!clock) {
    return <p className="notice" role="alert">The outage times don't add up. <a href="#/outage">Change the times</a> to start the clock.</p>;
  }
  const fill = outage.freezerFill === "full" ? "full" : outage.freezerFill === "half" ? "half full" : "if half full; set how full it is";
  const fridgeOk = clock.fridgeHours === FRIDGE_HOURS_DOOR_CLOSED ? "safe with the door closed"
    : outage.doorClosed ? `${clock.fridgeHours} hours: it read ${outage.fridgeTempF}°F` : `${clock.fridgeHours} hours with the door opened a lot`;
  const freezerTemp = outage.freezerTempF;
  return (
    <div className="clock">
      <p className="clock-since">
        {clock.running ? "Power out since " : "Power was out "}
        {clock.running ? formatClockTime(outage.start) : formatHours(clock.outMs / 3_600_000)}
        {clock.running && <span className="mono" aria-hidden="true"> · {hms(clock.outMs)}</span>}
      </p>
      <div className="clock-grid">
        <ClockCard title="Fridge" leftMs={clock.fridgeLeftMs} running={clock.running}
          ok={fridgeOk} past={`past ${clock.fridgeHours} hours: perishables need checking`} />
        {freezerTemp !== null && freezerTemp > 40
          ? <ClockCard title="Freezer" leftMs={null} running={clock.running} ok="" overText="Thawed"
            past={`it read ${freezerTemp}°F: check each item`} />
          : clock.freezerLeftMs === null
            ? <ClockCard title="Freezer" leftMs={null} running={clock.running} ok=""
              past={`${outage.doorClosed ? "less than half full" : "door opened a lot"}: no hold time. Check each item for ice crystals`} />
            : <ClockCard title="Freezer" leftMs={clock.freezerLeftMs} running={clock.running}
              ok={`holds about ${clock.freezerHold} hours (${fill})`} past={`past ${clock.freezerHold} hours: check each item`} />}
      </div>
    </div>
  );
}

function ClockCard({ title, leftMs, running, ok, past, overText }:
  { title: string; leftMs: number | null; running: boolean; ok: string; past: string; overText?: string }) {
  const over = leftMs === null || leftMs < 0;
  return (
    <div className={over ? "clock-card over" : "clock-card"}>
      <p className="clock-title">{title}</p>
      {/* The digits tick every second; screen readers get the minute, so moving past the clock isn't interrupted. */}
      {!over && running && (
        <p className="clock-time mono">
          <span aria-hidden="true">{hms(leftMs ?? 0)}</span>
          <span className="visually-hidden">{spokenLeft(leftMs ?? 0)}</span>
        </p>
      )}
      {!over && !running && <p className="clock-time">Within its time</p>}
      {over && <p className="clock-time">{overText ?? (leftMs === null ? "No hold time" : "Over")}</p>}
      <p className="clock-note">{over ? past : running ? `left · ${ok}` : ok}</p>
    </div>
  );
}

/** "3 hours 59 minutes" for the time left, to the minute. */
export function spokenLeft(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  return h ? (m ? `${part(h, "hour")} ${part(m, "minute")}` : part(h, "hour")) : part(m, "minute");
}
