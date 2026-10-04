import { useState } from "react";
import { CHART_REVIEWED, CHART_URL } from "../chart";
import { CALL_ORDER, verdict, type Call, type Item, type Outage, type Verdict } from "../rules";
import { ItemEditor } from "./ItemEditor";

const TITLES: Record<Call, string> = { toss: "Toss", check: "Check", refreeze: "Refreeze", keep: "Keep" };
const HINTS: Record<Call, string> = {
  toss: "Throw these out.",
  check: "Look closer before deciding. When in doubt, throw it out.",
  refreeze: "Safe to refreeze; quality may suffer.",
  keep: "Safe to keep.",
};

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
  return (
    <div className="verdicts">
      <p className="summary" aria-live="polite">
        {CALL_ORDER.map((call) => {
          const count = judged.filter((j) => j.verdict.call === call).length;
          return <span key={call} className={`count tag-${call}`}>{count} {TITLES[call].toLowerCase()}</span>;
        })}
      </p>
      {CALL_ORDER.map((call) => {
        const group = judged.filter((j) => j.verdict.call === call);
        if (!group.length) return null;
        return (
          <section key={call} className={`verdict-group group-${call}`} aria-labelledby={`h-${call}`}>
            <h2 id={`h-${call}`}><span className="tag-wrap"><span className={`tag tag-${call}`}>{TITLES[call]}</span></span> {HINTS[call]}</h2>
            <ul>
              {group.map(({ item, verdict }) => (
                <VerdictLine key={item.id} item={item} verdict={verdict} {...handlers}
                  editing={editing === item.id} onEdit={(open) => setEditing(open ? item.id : null)}
                  onToggleCleared={call === "toss" || call === "check" ? handlers.onToggleCleared : undefined} />
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

function VerdictLine({ item, verdict, editing, onEdit, onToggleCleared, onChange, onRemove }:
  { item: Item; verdict: Verdict; editing: boolean; onEdit: (open: boolean) => void } & Handlers) {
  const unsure = item.from === "photo" && (!item.sure || !item.row);
  return (
    <li className={item.cleared ? "line cleared" : "line"}>
      <div className="line-head">
        {onToggleCleared && (
          <input type="checkbox" checked={item.cleared} onChange={() => onToggleCleared(item)} aria-label={`Cleared ${item.name}`} />
        )}
        <span className="line-name">{item.name}</span>
        <span className="line-place">{item.place}</span>
      </div>
      <p className="line-why">{verdict.why}</p>
      {verdict.row && (
        <p className="line-row">
          Chart: “{verdict.row.label}”{verdict.column ? ` · ${verdict.column}` : ""}{verdict.row.onChart ? "" : " · not a chart row"}
        </p>
      )}
      {onChange && (
        <div className="line-actions">
          {unsure && <span className="unsure">Check the match</span>}
          <button type="button" className="link" aria-expanded={editing} onClick={() => onEdit(!editing)}>
            {editing ? "Done" : "Fix"}
          </button>
        </div>
      )}
      {editing && onChange && onRemove && (
        <ItemEditor item={item} onChange={(patch) => onChange(item, patch)} onRemove={() => onRemove(item)} />
      )}
    </li>
  );
}
