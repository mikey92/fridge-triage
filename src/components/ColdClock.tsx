import type { Outage } from "../rules";
import { formatHours } from "../rules";
import { coldClock, formatClockTime, hms, useNow } from "../time";

/** Two countdowns while the power is out: fridge 4 hours, freezer 24 or 48. */
export function ColdClock({ outage }: { outage: Outage }) {
  const now = useNow(1000);
  const clock = coldClock(outage, now);
  if (!clock || !outage.start) return null;
  const fill = outage.freezerFill === "full" ? "full" : outage.freezerFill === "half" ? "half full" : "fill not set, so half full";
  return (
    <div className="clock">
      <p className="clock-since">
        {clock.running ? "Power out since " : "Power was out "}
        {clock.running ? formatClockTime(outage.start) : formatHours(clock.outMs / 3_600_000)}
        {clock.running && <span className="mono"> · {hms(clock.outMs)}</span>}
      </p>
      <div className="clock-grid">
        <ClockCard title="Fridge" leftMs={clock.fridgeLeftMs} running={clock.running}
          ok="safe with the door closed" past="past 4 hours: perishables need checking" />
        <ClockCard title="Freezer" leftMs={clock.freezerLeftMs} running={clock.running}
          ok={`holds about ${clock.freezerHold} hours (${fill})`} past={`past ${clock.freezerHold} hours: check each item`} />
      </div>
    </div>
  );
}

function ClockCard({ title, leftMs, running, ok, past }: { title: string; leftMs: number; running: boolean; ok: string; past: string }) {
  const over = leftMs <= 0;
  return (
    <div className={over ? "clock-card over" : "clock-card"}>
      <p className="clock-title">{title}</p>
      {!over && running && <p className="clock-time mono" aria-label={`${title}: ${hms(leftMs)} left`}>{hms(leftMs)}</p>}
      {!over && !running && <p className="clock-time">Within its time</p>}
      {over && <p className="clock-time">Over</p>}
      <p className="clock-note">{over ? past : running ? `left · ${ok}` : ok}</p>
    </div>
  );
}
