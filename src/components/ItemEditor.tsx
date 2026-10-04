import { useState } from "react";
import type { Place } from "../chart";
import { effectiveRow, moveRow, type Item } from "../rules";
import { RowPicker } from "./RowPicker";

/** One-tap fixes for an item: its chart row, cut/whole, opened/sealed, fridge/freezer, ice crystals, or remove it. */
export function ItemEditor({ item, onChange, onRemove }: {
  item: Item;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const [picking, setPicking] = useState(!item.row);
  const row = effectiveRow(item);

  const movePlace = (place: Place) => {
    if (place === item.place) return;
    const moved = moveRow(row?.id ?? null);
    onChange({ place, row: moved, ice: false, sure: !!moved });
    setPicking(!moved);
  };

  return (
    <div className="editor">
      <div className="segmented" role="group" aria-label="Where is it?">
        {(["fridge", "freezer"] as const).map((place) => (
          <button key={place} type="button" aria-pressed={item.place === place} onClick={() => movePlace(place)}>
            {place === "fridge" ? "Fridge" : "Freezer"}
          </button>
        ))}
      </div>

      {row?.cut !== undefined && (
        <Choice label="Is it cut?" value={row.cut} yes="Cut or sliced" no="Whole" onPick={(cut) => onChange({ cut })} />
      )}
      {row?.opened !== undefined && (
        <Choice label="Is it opened?" value={row.opened} yes="Opened" no="Sealed" onPick={(opened) => onChange({ opened })} />
      )}
      {item.place === "freezer" && (
        <label className="check-row">
          <input type="checkbox" checked={item.ice} onChange={(event) => onChange({ ice: event.target.checked })} />
          Still has ice crystals, or feels as cold as the fridge
        </label>
      )}

      <div className="editor-row">
        <p className="muted">{row ? <>On the chart as “{row.label}”</> : "Not matched to a chart row yet."}</p>
        {!picking && <button type="button" className="link" onClick={() => setPicking(true)}>Change the match</button>}
      </div>
      {picking && (
        <RowPicker place={item.place} label="Which chart row is it?" autoFocus
          onPick={(picked) => { onChange({ row: picked.id, cut: null, opened: null, sure: true }); setPicking(false); }} />
      )}

      <button type="button" className="danger" onClick={onRemove}>Remove “{item.name}”</button>
    </div>
  );
}

function Choice({ label, value, yes, no, onPick }: { label: string; value: boolean; yes: string; no: string; onPick: (value: boolean) => void }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      <button type="button" aria-pressed={value} onClick={() => onPick(true)}>{yes}</button>
      <button type="button" aria-pressed={!value} onClick={() => onPick(false)}>{no}</button>
    </div>
  );
}
