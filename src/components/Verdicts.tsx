import { useEffect, useRef, useState } from "react";
import { CHART_REVIEWED, CHART_URL } from "../chart";
import { verdict, type Call, type Item, type Outage, type Verdict } from "../rules";
import { ItemEditor } from "./ItemEditor";

// The calls, plus "confirm": AI matches the chart would keep or refreeze, waiting for the person's Yes (their call is check).
type Group = Call | "confirm";
const GROUPS: Group[] = ["toss", "check", "confirm", "refreeze", "keep"];
const TITLES: Record<Group, string> = { toss: "Toss", check: "Check", confirm: "Confirm", refreeze: "Refreeze", keep: "Keep" };
const COUNTS: Record<Group, string> = { toss: "toss", check: "check", confirm: "to confirm", refreeze: "refreeze", keep: "keep" };
const HINTS: Record<Group, string> = {
  toss: "Throw these out.",
  check: "Look closer before deciding. When in doubt, throw it out.",
  confirm: "Fine to keep or refreeze if the AI named them right. Look at each one, then tap Yes.",
  refreeze: "Safe to refreeze; quality may suffer.",
  keep: "Safe to keep.",
};
const groupOf = (v: Verdict): Group => (v.pending ? "confirm" : v.call);

export function judge(items: Item[], outage: Outage, now: number) {
  return items.map((item) => ({ item, verdict: verdict(item, outage, now) }));
}

type Handlers = {
  onToggleCleared?: (item: Item) => void;
  onChange?: (item: Item, patch: Partial<Item>) => void;
  onRemove?: (item: Item) => void;
};

/** The four sections in Toss, Check, Refreeze, Keep order, each item with its reason and chart row. */
export function Verdicts({ items, outage, now, ...handlers }: { items: Item[]; outage: Outage; now: number } & Handlers) {
  const judged = judge(items, outage, now);
  // Kept here, not in each line, so an item's editor stays open when a fix moves it to another section.
  const [editing, setEditing] = useState<string | null>(null);
  if (!items.length) {
    return (
      <div className="verdicts">
        <p className="notice">No food on the list yet. <a href="#/check">Add a photo or add items by hand.</a></p>
      </div>
    );
  }
  // After a removal, keep the keyboard where it was: the next item's Fix button, or the heading.
  const remove = handlers.onRemove && ((item: Item) => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".line-actions .fix")];
    const at = buttons.findIndex((button) => button.dataset.item === item.id);
    const next = buttons[at + 1] ?? buttons[at - 1];
    handlers.onRemove!(item);
    requestAnimationFrame(() => (next && document.contains(next) ? next : document.querySelector<HTMLElement>("main h1"))?.focus());
  });
  // After a Yes, go on to the next item waiting for one; after the last, stay with this item in its new section.
  const confirm = handlers.onChange && ((item: Item) => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".line-actions .yes")];
    const at = buttons.findIndex((button) => button.dataset.item === item.id);
    const next = buttons[at + 1] ?? buttons[at - 1];
    if (!next) refocus = item.id;
    handlers.onChange!(item, { confirmed: true });
    if (next) requestAnimationFrame(() => document.contains(next) && next.focus());
  });
  return (
    <div className="verdicts">
      <p className="summary" aria-live="polite">
        {GROUPS.map((group) => {
          const count = judged.filter((j) => groupOf(j.verdict) === group).length;
          if (group === "confirm" && !count) return null;
          return <span key={group} className={`count tag-${group}`}>{count} {COUNTS[group]}</span>;
        })}
      </p>
      {GROUPS.map((group) => {
        const lines = judged.filter((j) => groupOf(j.verdict) === group);
        if (!lines.length) return null;
        return (
          <section key={group} className={`verdict-group group-${group}`} aria-labelledby={`h-${group}`}>
            <h2 id={`h-${group}`}><span className="tag-wrap"><span className={`tag tag-${group}`}>{TITLES[group]}</span></span> {HINTS[group]}</h2>
            <ul>
              {lines.map(({ item, verdict }) => (
                <VerdictLine key={item.id} item={item} verdict={verdict} {...handlers} onRemove={remove} onConfirm={confirm}
                  editing={editing === item.id} onEdit={(open) => setEditing(open ? item.id : null)}
                  onToggleCleared={group === "toss" || group === "check" ? handlers.onToggleCleared : undefined} />
              ))}
            </ul>
          </section>
        );
      })}
      <p className="source">
        Rules from the <a href={CHART_URL} target="_blank" rel="noreferrer">FoodSafety.gov power-outage charts</a> (reviewed {CHART_REVIEWED}).
        Never taste food to decide. When in doubt, throw it out.
      </p>
    </div>
  );
}

let refocus: string | null = null; // the item whose editor just changed it

function VerdictLine({ item, verdict, editing, onEdit, onToggleCleared, onChange, onRemove, onConfirm }:
  { item: Item; verdict: Verdict; editing: boolean; onEdit: (open: boolean) => void; onConfirm?: (item: Item) => void } & Handlers) {
  const unmatched = item.from === "photo" && !item.row;
  const fix = useRef<HTMLButtonElement>(null);
  // A fix can move the item to another section, which re-creates this line: put the focus back on its Done button.
  useEffect(() => {
    if (refocus === item.id && document.activeElement === document.body) fix.current?.focus();
    if (refocus === item.id) refocus = null;
  });
  return (
    <li className={item.cleared ? "line cleared" : "line"}>
      <div className="line-head">
        {onToggleCleared ? (
          <label className="clear-toggle">
            <input type="checkbox" checked={item.cleared} onChange={() => onToggleCleared(item)} />
            <span className="line-name">{item.name}</span>
            <span className="visually-hidden"> (tick when cleared)</span>
          </label>
        ) : <span className="line-name">{item.name}</span>}
        <span className="line-place">{item.place}</span>
      </div>
      <p className="line-why">{verdict.why}</p>
      {verdict.row && (
        <p className="line-row">
          {verdict.row.onChart
            ? <>Chart: “{verdict.row.label}”{verdict.column ? ` · ${verdict.column}` : ""}</>
            : <>App rule for {verdict.row.label.charAt(0).toLowerCase() + verdict.row.label.slice(1)} (not a chart row)</>}
        </p>
      )}
      {onChange && (
        <div className="line-actions">
          {unmatched && <span className="unsure">Pick its chart row</span>}
          {verdict.pending && onConfirm && (
            <button type="button" className="secondary yes" data-item={item.id} aria-label={`Yes, “${item.name}” is right`}
              onClick={() => onConfirm(item)}>Yes, that's right</button>
          )}
          <button ref={fix} type="button" className="link fix" data-item={item.id} aria-expanded={editing}
            aria-label={`${editing ? "Done fixing" : "Fix"} ${item.name}`} onClick={() => onEdit(!editing)}>
            {editing ? "Done" : "Fix"}
          </button>
        </div>
      )}
      {editing && onChange && onRemove && (
        <ItemEditor item={item} onChange={(patch) => { refocus = item.id; onChange(item, patch); }} onRemove={() => onRemove(item)} />
      )}
    </li>
  );
}
