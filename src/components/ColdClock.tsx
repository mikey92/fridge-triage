import type { Outage } from "../rules";
import { formatHours } from "../rules";
import { coldClock, formatClockTime, hms, useNow } from "../time";

/** Two countdowns while the power is out: fridge 4 hours, freezer 24 or 48. */
export function ColdClock({ outage }: { outage: Outage }) {
  const now = useNow(1000);
  const clock = coldClock(outage, now);
  if (!outage.start) return null;
  if (!clock) {
    return <p className="notice" role="alert">The outage times don't add up. <a href="#/outage">Change the times</a> to start the clock.</p>;
  }
  const fill = outage.freezerFill === "full" ? "full" : outage.freezerFill === "half" ? "half full" : "if half full; set how full it is";
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
        {clock.freezerLeftMs === null
          ? <ClockCard title="Freezer" leftMs={null} running={clock.running} ok="" past="less than half full: no hold time. Check each item for ice crystals" />
          : <ClockCard title="Freezer" leftMs={clock.freezerLeftMs} running={clock.running}
            ok={`holds about ${clock.freezerHold} hours (${fill})`} past={`past ${clock.freezerHold} hours: check each item`} />}
      </div>
    </div>
  );
}

function ClockCard({ title, leftMs, running, ok, past }: { title: string; leftMs: number | null; running: boolean; ok: string; past: string }) {
  const over = leftMs === null || leftMs < 0;
  return (
    <div className={over ? "clock-card over" : "clock-card"}>
      <p className="clock-title">{title}</p>
      {!over && running && <p className="clock-time mono" aria-label={`${title}: ${hms(leftMs ?? 0)} left`}>{hms(leftMs ?? 0)}</p>}
      {!over && !running && <p className="clock-time">Within its time</p>}
      {over && <p className="clock-time">{leftMs === null ? "No hold time" : "Over"}</p>}
      <p className="clock-note">{over ? past : running ? `left · ${ok}` : ok}</p>
    </div>
  );
}
