import { useId, useState } from "react";
import type { Outage } from "../rules";
import { fromLocalInput, toLocalInput } from "../time";

const GRACE = 5 * 60_000;

/** What's wrong with the outage times, if anything: shown under the fields, and it holds back the Next button. */
export function outageTimeProblem(outage: Outage, now: number): { start?: string; end?: string } {
  const start = outage.start ? Date.parse(outage.start) : null;
  const end = outage.end ? Date.parse(outage.end) : null;
  const problem: { start?: string; end?: string } = {};
  if (start !== null && start > now + GRACE) problem.start = "That's in the future. Check the date.";
  if (end !== null && end > now + GRACE) problem.end = "That's in the future. Check the date.";
  else if (start !== null && end !== null && end < start) problem.end = "That's before the power went out.";
  return problem;
}

/** When the power went out and came back, the freezer, the doors, and any thermometer readings. */
export function OutageForm({ outage, onChange, now }: { outage: Outage; onChange: (patch: Partial<Outage>) => void; now: number }) {
  const id = useId();
  const stillOut = !outage.end;
  const problem = outageTimeProblem(outage, now);
  const nowInput = toLocalInput(new Date(now).toISOString());
  // Open at first if there are readings; after that the person opens and closes it.
  const [readingsOpen] = useState(outage.fridgeTempF !== null || outage.freezerTempF !== null);
  const [unit, setUnit] = useState<"F" | "C">("F");

  return (
    <div className="form">
      <div className="field">
        <label htmlFor={`${id}-start`}>The power went out</label>
        <input id={`${id}-start`} type="datetime-local" step={300} max={nowInput} value={toLocalInput(outage.start)}
          aria-invalid={!!problem.start} aria-describedby={problem.start ? `${id}-start-error` : undefined}
          onChange={(event) => onChange({ start: fromLocalInput(event.target.value) })} />
        {problem.start && <p id={`${id}-start-error`} className="error">{problem.start}</p>}
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
              aria-invalid={!!problem.end} aria-describedby={problem.end ? `${id}-end-error` : undefined}
              onChange={(event) => onChange({ end: fromLocalInput(event.target.value) })} />
            {problem.end && <p id={`${id}-end-error`} className="error">{problem.end}</p>}
          </>
        )}
      </div>

      <fieldset className="field">
        <legend>How full is the freezer?</legend>
        <div className="segmented">
          {([["full", "Full"], ["half", "Half full"], ["low", "Less than half"], ["unknown", "Not sure"]] as const).map(([value, text]) => (
            <button key={value} type="button" aria-pressed={outage.freezerFill === value} onClick={() => onChange({ freezerFill: value })}>
              {text}
            </button>
          ))}
        </div>
        <p className="hint">With the door closed, a full freezer holds about 48 hours and a half-full one about 24. Otherwise, check each item for ice crystals.</p>
      </fieldset>

      <div className="field">
        <label className="check-row">
          <input type="checkbox" checked={outage.doorClosed} onChange={(event) => onChange({ doorClosed: event.target.checked })} />
          The fridge and freezer doors stayed mostly closed
        </label>
        <p className="hint">The 4-hour and 48-hour rules assume closed doors. If they were opened a lot, the app allows the fridge 2 hours and asks about ice crystals in the freezer.</p>
      </div>

      <details className="field" open={readingsOpen}>
        <summary>I have a thermometer reading</summary>
        <p className="hint">Read it as soon as the power comes back, before the fridge cools down again.</p>
        <div className="segmented unit" role="group" aria-label="Thermometer unit">
          {(["F", "C"] as const).map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>°{u}</button>
          ))}
        </div>
        <TempInput key={`fridge-${unit}`} id={`${id}-fridge-temp`} label="Fridge" unit={unit} minF={32} value={outage.fridgeTempF}
          tooLow="A fridge can't read below freezing after an outage. Check the unit." onChange={(fridgeTempF) => onChange({ fridgeTempF })} />
        <TempInput key={`freezer-${unit}`} id={`${id}-freezer-temp`} label="Freezer" unit={unit} minF={-40} value={outage.freezerTempF}
          tooLow="That's colder than a home freezer gets. Check the unit." onChange={(freezerTempF) => onChange({ freezerTempF })} />
      </details>
    </div>
  );
}

const toC = (f: number) => Math.round(((f - 32) * 5) / 9 * 10) / 10;
const toF = (c: number) => Math.round((c * 9) / 5 * 10 + 320) / 10;

/** A reading in °F or °C. Only plausible readings reach the verdicts; anything else shows why and counts as no reading. */
function TempInput({ id, label, unit, minF, value, tooLow, onChange }: {
  id: string; label: string; unit: "F" | "C"; minF: number; value: number | null; tooLow: string; onChange: (valueF: number | null) => void;
}) {
  const shown = value === null ? "" : String(unit === "F" ? value : toC(value));
  const [text, setText] = useState(shown);
  const typed = text.trim() === "" ? null : Number(text);
  const valueF = typed === null || Number.isNaN(typed) ? null : unit === "F" ? typed : toF(typed);
  const error = typed !== null && (Number.isNaN(typed) || valueF === null)
    ? "Enter a number."
    : valueF !== null && valueF < minF ? tooLow : valueF !== null && valueF > 100 ? "That's warmer than a kitchen gets. Check the number." : "";
  const errorId = `${id}-error`;
  return (
    <div className="temp">
      <label htmlFor={id}>{label} (°{unit})</label>
      <input id={id} type="number" inputMode="decimal" step="any" value={text} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const n = next.trim() === "" ? null : Number(next);
          const f = n === null || Number.isNaN(n) ? null : unit === "F" ? n : toF(n);
          onChange(f !== null && f >= minF && f <= 100 ? f : null);
        }} />
      {error && <p id={errorId} className="error">{error}</p>}
    </div>
  );
}
