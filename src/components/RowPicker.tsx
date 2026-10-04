import { useId, useState } from "react";
import { searchRows, type Place, type Row } from "../chart";

/** Search one appliance's chart by everyday words and pick a row. */
export function RowPicker({ place, onPick, label = "Find it on the chart", autoFocus = false }: {
  place: Place;
  onPick: (row: Row, typed: string) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const id = useId();
  const results = query.trim() ? searchRows(place, query).slice(0, 8) : [];
  return (
    <div className="picker">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="search" value={query} autoFocus={autoFocus} autoComplete="off"
        placeholder={place === "fridge" ? "milk, cheddar, leftover rice…" : "ice cream, frozen peas…"}
        onChange={(event) => setQuery(event.target.value)} />
      {results.length > 0 && (
        <ul className="picker-results">
          {results.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => { onPick(row, query.trim()); setQuery(""); }}>
                <span className="picker-label">{row.label}</span>
                <span className="picker-group">{row.group}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.length === 0 && <p className="muted">Nothing on the chart matches “{query}”.</p>}
    </div>
  );
}
