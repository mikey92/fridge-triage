import { useEffect, useState } from "react";
import type { Place, Row } from "./chart";
import { ColdClock } from "./components/ColdClock";
import { LossRecord } from "./components/LossRecord";
import { OutageForm, outageTimeProblem } from "./components/OutageForm";
import { PhotoSlots } from "./components/PhotoSlots";
import { RowPicker } from "./components/RowPicker";
import { Verdicts } from "./components/Verdicts";
import { formatHours, outageHours } from "./rules";
import { newItem, useAppState, type Action, type State } from "./store";
import { useNow } from "./time";

type Route = "home" | "outage" | "check" | "results" | "record";
const ROUTES: Route[] = ["home", "outage", "check", "results", "record"];

function readRoute(): Route {
  const name = window.location.hash.replace(/^#\/?/, "") as Route;
  return ROUTES.includes(name) ? name : "home";
}

/** Puts keyboard and screen-reader focus on the screen's heading, after a screen change or when the content under
 * the focused control is replaced (starting the clock, starting over). */
function focusHeading() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>("main h1, main h2")?.focus({ preventScroll: true }));
}

function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    focusHeading();
  }, [route]);
  const go = (next: Route) => {
    window.location.hash = next === "home" ? "/" : `/${next}`;
  };
  return [route, go];
}

export function App() {
  const [state, dispatch] = useAppState();
  const [route, go] = useRoute();
  const now = useNow(30_000);
  const started = !!state.outage.start || state.items.length > 0;

  return (
    <div className="app">
      <header className="top no-print">
        <a className="brand" href="#/">Fridge Triage</a>
        {started && (
          <button type="button" className="link" onClick={() => {
            if (window.confirm("Clear the outage times and the item list on this device?")) {
              dispatch({ type: "reset" });
              go("home");
              focusHeading();
            }
          }}>Start over</button>
        )}
      </header>
      <main>
        {route === "home" && <Home state={state} dispatch={dispatch} go={go} />}
        {route === "outage" && (
          <section>
            <h1 tabIndex={-1}>Outage details</h1>
            <OutageForm outage={state.outage} now={now} onChange={(patch) => dispatch({ type: "outage", patch })} />
            <button type="button" className="primary"
              disabled={!state.outage.start || Object.keys(outageTimeProblem(state.outage, now)).length > 0}
              onClick={() => go(state.items.length ? "results" : "check")}>
              {state.items.length ? "See what to do" : "Next: check my food"}
            </button>
          </section>
        )}
        {route === "check" && <Check state={state} dispatch={dispatch} go={go} />}
        {route === "results" && <Results state={state} dispatch={dispatch} go={go} now={now} />}
        {route === "record" && (
          <>
            <LossRecord items={state.items} outage={state.outage} now={now} />
            <div className="stack no-print">
              <button type="button" className="primary" onClick={() => window.print()}>Print or save as PDF</button>
              <button type="button" className="link" onClick={() => go("results")}>Back to the list</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

type ScreenProps = { state: State; dispatch: (action: Action) => void; go: (route: Route) => void };

function Home({ state, dispatch, go }: ScreenProps) {
  const { outage } = state;
  if (!outage.start) {
    return (
      <section>
        <h1 tabIndex={-1}>Power outage?</h1>
        <p className="lead">Start the cold clock now. When the power comes back, check your fridge and freezer item by item against the FoodSafety.gov charts.</p>
        <div className="stack">
          <button type="button" className="primary" onClick={() => {
            dispatch({ type: "outage", patch: { start: new Date().toISOString(), end: null } });
            focusHeading();
          }}>
            The power is out
          </button>
          <button type="button" className="secondary" onClick={() => {
            dispatch({ type: "outage", patch: { end: new Date().toISOString() } });
            go("outage");
          }}>The power is back: check my food</button>
        </div>
        <ol className="steps">
          <li><strong>Start the cold clock</strong> when the power goes out: the fridge keeps food safe for about 4 hours, the freezer 24 to 48.</li>
          <li><strong>Photograph the fridge and freezer</strong> when it's back, or add items by hand.</li>
          <li><strong>Get Toss, Check, Refreeze or Keep</strong> for every item, with the chart row it comes from, and a dated record of what you threw out.</li>
        </ol>
        <p className="muted small">The AI only names the food. Every decision comes from the FoodSafety.gov power-outage charts.</p>
        <p className="muted small">Add Fridge Triage to your home screen: once opened, it works with no connection, except for reading photos.</p>
      </section>
    );
  }
  return (
    <section>
      <h1 tabIndex={-1}>{outage.end ? "The power is back" : "The power is out"}</h1>
      <ColdClock outage={outage} />
      {!outage.end && (
        <ul className="tips">
          <li>Keep the fridge and freezer doors closed.</li>
          <li>If it will be out for more than 4 hours, move fridge food to a cooler with ice.</li>
          <li>A thermometer in each will tell you for sure.</li>
        </ul>
      )}
      <div className="stack">
        {!outage.end && (
          <button type="button" className="primary" onClick={() => {
            dispatch({ type: "outage", patch: { end: new Date().toISOString() } });
            go("check");
          }}>The power is back</button>
        )}
        <button type="button" className={outage.end ? "primary" : "secondary"} onClick={() => go(state.items.length ? "results" : "check")}>
          {outage.end ? "Check my food" : "Check my food now"}
        </button>
        <button type="button" className="link" onClick={() => go("outage")}>Change the times</button>
      </div>
    </section>
  );
}

function Check({ state, dispatch, go }: ScreenProps) {
  const [place, setPlace] = useState<Place>("fridge");
  const count = state.items.length;
  return (
    <section>
      <h1 tabIndex={-1}>Check my food</h1>
      {!state.outage.start && (
        <p className="notice">Add <a href="#/outage">when the power went out</a> to get verdicts.</p>
      )}
      <div className="card">
        <PhotoSlots onItems={(found) => dispatch({ type: "add", items: found.map((item) => newItem({ ...item, from: "photo" })) })} />
      </div>
      <h2 className="subhead">Or add items by hand</h2>
      <div className="card">
        <div className="segmented" role="group" aria-label="Where is it?">
          {(["fridge", "freezer"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={place === p} onClick={() => setPlace(p)}>{p === "fridge" ? "Fridge" : "Freezer"}</button>
          ))}
        </div>
        <RowPicker place={place} label={`Add something from the ${place}`}
          onPick={(row, typed) => dispatch({ type: "add", items: [newItem({ name: nameFor(row, typed), place, row: row.id })] })} />
        {count > 0 && (
          <p className="muted added">
            {count} item{count === 1 ? "" : "s"} so far: {state.items.slice(-4).map((item) => item.name).join(", ")}{count > 4 ? "…" : ""}
          </p>
        )}
      </div>
      <button type="button" className="primary" disabled={!count} onClick={() => go("results")}>
        {count ? `See what to do with ${count} item${count === 1 ? "" : "s"}` : "Add food to see what to do"}
      </button>
    </section>
  );
}

function Results({ state, dispatch, go, now }: ScreenProps & { now: number }) {
  const hours = outageHours(state.outage, now);
  return (
    <section>
      <h1 tabIndex={-1}>What to do</h1>
      <p className="outage-line">
        {hours !== null
          ? `Power ${state.outage.end ? "was" : "has been"} out ${formatHours(hours)}. `
          : state.outage.start ? "The outage times don't add up. " : "No outage times yet. "}
        <a href="#/outage">Change</a>
      </p>
      <Verdicts items={state.items} outage={state.outage} now={now}
        onToggleCleared={(item) => dispatch({ type: "update", id: item.id, patch: { cleared: !item.cleared } })}
        onChange={(item, patch) => dispatch({ type: "update", id: item.id, patch })}
        onRemove={(item) => dispatch({ type: "remove", id: item.id })} />
      <div className="stack">
        <button type="button" className="primary" onClick={() => go("record")}>Save loss record</button>
        <button type="button" className="secondary" onClick={() => go("check")}>Add more food</button>
      </div>
    </section>
  );
}

/** A name for a hand-added item: the everyday word the search matched ("shredded" → "shredded cheese"). */
function nameFor(row: Row, typed: string): string {
  const q = typed.toLowerCase();
  return row.words.find((word) => word.toLowerCase() === q) ?? row.words.find((word) => word.toLowerCase().includes(q)) ?? (typed || row.label);
}
