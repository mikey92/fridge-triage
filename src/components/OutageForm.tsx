import { useEffect, useId, useState } from "react";
import { endsBeforeStart, FREEZER_MIN_F, FRIDGE_MIN_F, GRACE, MAX_F, type Outage } from "../rules";
import { fromLocalInput, toLocalInput } from "../time";

/** What's wrong with the outage times, if anything: shown under the fields, and it holds back the Next button.
 * Same terms as outageSpan in rules.ts, so the form and the verdicts never disagree. */
export function outageTimeProblem(outage: Outage, now: number): { start?: string; end?: string } {
  const start = outage.start ? Date.parse(outage.start) : null;
  const end = outage.end ? Date.parse(outage.end) : null;
  const problem: { start?: string; end?: string } = {};
  if (start !== null && start > now + GRACE) problem.start = "That's in the future. Check the date.";
  if (end !== null && end > now + GRACE) problem.end = "That's in the future. Check the date.";
  else if (start !== null && end !== null && endsBeforeStart(start, end)) problem.end = "That's before the power went out.";
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
        <DateTimeInput id={`${id}-start`} max={nowInput} value={outage.start} error={problem.start}
          onChange={(start) => onChange({ start })} />
      </div>

      <div className="field">
        <label className="check-row">
          <input type="checkbox" checked={stillOut}
            onChange={(event) => onChange({ end: event.target.checked ? null : new Date().toISOString() })} />
          The power is still out
        </label>
        {!stillOut && (
          <>
            <label htmlFor={`${id}-end`}>The power came back</label>
            <DateTimeInput id={`${id}-end`} max={nowInput} value={outage.end} error={problem.end}
              onChange={(end) => onChange({ end })} />
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
        <TempInput key={`fridge-${unit}`} id={`${id}-fridge-temp`} label="Fridge" unit={unit} minF={FRIDGE_MIN_F} value={outage.fridgeTempF}
          tooLow="A fridge can't read below freezing after an outage. Check the unit." onChange={(fridgeTempF) => onChange({ fridgeTempF })} />
        <TempInput key={`freezer-${unit}`} id={`${id}-freezer-temp`} label="Freezer" unit={unit} minF={FREEZER_MIN_F} value={outage.freezerTempF}
          tooLow="That's colder than a home freezer gets. Check the unit." onChange={(freezerTempF) => onChange({ freezerTempF })} />
      </details>
    </div>
  );
}

/** A date and time to the minute. While a part of it is being retyped the field is briefly incomplete: that keeps the
 * saved time instead of wiping it, and only a complete time is saved. */
function DateTimeInput({ id, max, value, error, onChange }: {
  id: string; max: string; value: string | null; error?: string; onChange: (iso: string) => void;
}) {
  const [text, setText] = useState(() => toLocalInput(value));
  // A change made elsewhere (the home screen's buttons, another tab) shows here; the person's own typing isn't undone.
  useEffect(() => {
    setText((current) => (fromLocalInput(current) === value ? current : toLocalInput(value)));
  }, [value]);
  const errorId = `${id}-error`;
  return (
    <>
      <input id={id} type="datetime-local" step={300} max={max} value={text}
        aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setText(event.target.value);
          const iso = fromLocalInput(event.target.value);
          if (iso) onChange(iso);
        }} />
      {error && <p id={errorId} className="error" role="alert">{error}</p>}
    </>
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
  const [garbled, setGarbled] = useState(false); // the browser hides text that isn't a number ("1e", "-") from the value
  const typed = text.trim() === "" ? null : Number(text);
  const valueF = typed === null || Number.isNaN(typed) ? null : unit === "F" ? typed : toF(typed);
  const error = garbled || (typed !== null && (Number.isNaN(typed) || valueF === null))
    ? "Enter a number."
    : valueF !== null && valueF < minF ? tooLow : valueF !== null && valueF > MAX_F ? "That's warmer than a kitchen gets. Check the number." : "";
  const errorId = `${id}-error`;
  return (
    <div className="temp">
      <label htmlFor={id}>{label} (°{unit})</label>
      <input id={id} type="number" inputMode="decimal" step="any" value={text} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          setGarbled(event.target.validity.badInput);
          const n = next.trim() === "" ? null : Number(next);
          const f = n === null || Number.isNaN(n) ? null : unit === "F" ? n : toF(n);
          onChange(f !== null && f >= minF && f <= MAX_F ? f : null);
        }} />
      {error && <p id={errorId} className="error" role="alert">{error}</p>}
    </div>
  );
}
