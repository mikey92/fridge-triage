import { useId } from "react";
import type { Outage } from "../rules";
import { fromLocalInput, toLocalInput } from "../time";

/** When the power went out and came back, the freezer, the door, and any thermometer readings. */
export function OutageForm({ outage, onChange, now }: { outage: Outage; onChange: (patch: Partial<Outage>) => void; now: number }) {
  const id = useId();
  const stillOut = !outage.end;
  const endBeforeStart = !!outage.start && !!outage.end && Date.parse(outage.end) < Date.parse(outage.start);
  const nowInput = toLocalInput(new Date(now).toISOString());

  return (
    <div className="form">
      <div className="field">
        <label htmlFor={`${id}-start`}>The power went out</label>
        <input id={`${id}-start`} type="datetime-local" step={300} max={nowInput} value={toLocalInput(outage.start)}
          onChange={(event) => onChange({ start: fromLocalInput(event.target.value) })} />
      </div>

      <div className="field">
        <label className="check-row">
          <input type="checkbox" checked={stillOut}
            onChange={(event) => onChange({ end: event.target.checked ? null : new Date(now).toISOString() })} />
          The power is still out
        </label>
        {!stillOut && (
          <>
            <label htmlFor={`${id}-end`}>The power came back</label>
            <input id={`${id}-end`} type="datetime-local" step={300} max={nowInput} value={toLocalInput(outage.end)}
              aria-invalid={endBeforeStart} aria-describedby={endBeforeStart ? `${id}-end-error` : undefined}
              onChange={(event) => onChange({ end: fromLocalInput(event.target.value) })} />
            {endBeforeStart && <p id={`${id}-end-error`} className="error">That's before the power went out.</p>}
          </>
        )}
      </div>

      <fieldset className="field">
        <legend>How full is the freezer?</legend>
        <div className="segmented">
          {([["full", "Full"], ["half", "Half full"], ["unknown", "Not sure"]] as const).map(([value, text]) => (
            <button key={value} type="button" aria-pressed={outage.freezerFill === value} onClick={() => onChange({ freezerFill: value })}>
              {text}
            </button>
          ))}
        </div>
        <p className="hint">A full freezer holds about 48 hours, a half-full one about 24. “Not sure” counts as half full.</p>
      </fieldset>

      <div className="field">
        <label className="check-row">
          <input type="checkbox" checked={outage.doorClosed} onChange={(event) => onChange({ doorClosed: event.target.checked })} />
          The fridge door stayed mostly closed
        </label>
        <p className="hint">The 4-hour rule assumes a closed door. If it was opened a lot, the app uses 2 hours instead.</p>
      </div>

      <details className="field" open={outage.fridgeTempF !== null || outage.freezerTempF !== null}>
        <summary>I have a thermometer reading</summary>
        <p className="hint">Read it as soon as the power comes back, before the fridge cools down again.</p>
        <TempInput id={`${id}-fridge-temp`} label="Fridge (°F)" value={outage.fridgeTempF} onChange={(fridgeTempF) => onChange({ fridgeTempF })} />
        <TempInput id={`${id}-freezer-temp`} label="Freezer (°F)" value={outage.freezerTempF} onChange={(freezerTempF) => onChange({ freezerTempF })} />
      </details>
    </div>
  );
}

function TempInput({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="temp">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min={-20} max={90} step={1} value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} />
    </div>
  );
}
