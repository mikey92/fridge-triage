import { useState } from "react";
import type { Place, Row } from "./chart";
import { RowPicker } from "./components/RowPicker";
import { Verdicts } from "./components/Verdicts";
import { newItem, useAppState } from "./store";

export function App() {
  const [state, dispatch] = useAppState();
  const [place, setPlace] = useState<Place>("fridge");
  const now = Date.now();
  const hoursOut = state.outage.start && state.outage.end
    ? (Date.parse(state.outage.end) - Date.parse(state.outage.start)) / 3_600_000
    : "";

  const setHours = (hours: number) => {
    const end = Date.now();
    dispatch({ type: "outage", patch: { start: new Date(end - hours * 3_600_000).toISOString(), end: new Date(end).toISOString() } });
  };

  return (
    <div className="app">
      <header className="top">
        <h1>Fridge Triage</h1>
        <p className="muted">After a power outage: what to keep, what to toss.</p>
      </header>

      <section className="card">
        <label htmlFor="hours">How many hours was the power out?</label>
        <input id="hours" type="number" min={0} max={240} step={0.5} inputMode="decimal" value={hoursOut}
          onChange={(event) => setHours(Number(event.target.value) || 0)} />
      </section>

      <section className="card">
        <div className="segmented" role="group" aria-label="Where is it?">
          {(["fridge", "freezer"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={place === p} onClick={() => setPlace(p)}>{p === "fridge" ? "Fridge" : "Freezer"}</button>
          ))}
        </div>
        <RowPicker place={place} label={`Add something from the ${place}`}
          onPick={(row, typed) => dispatch({ type: "add", items: [newItem({ name: nameFor(row, typed), place, row: row.id })] })} />
      </section>

      {state.items.length > 0 && <Verdicts items={state.items} outage={state.outage} now={now} />}
    </div>
  );
}

/** A name for a hand-added item: the everyday word the search matched ("shredded" → "shredded cheese"). */
function nameFor(row: Row, typed: string): string {
  const q = typed.toLowerCase();
  return row.words.find((word) => word.toLowerCase() === q) ?? row.words.find((word) => word.toLowerCase().includes(q)) ?? (typed || row.label);
}
