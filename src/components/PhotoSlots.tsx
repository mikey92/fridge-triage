import { useEffect, useRef, useState } from "react";
import { shrinkPhoto } from "../photos";
import type { Place } from "../chart";
import { recognizePhoto, type RecognizedItem } from "../recognize";
import { currentList } from "../store";

type Slot = { id: number; preview: string; status: "reading" | "done" | "error"; message: string };

export const MAX_PHOTOS = 3;
export const SAMPLE_PHOTO = "/sample-fridge.jpg";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}

/** Up to three photos; each is read once and its items handed to onItems. Photos are kept only in memory. */
export function PhotoSlots({ onItems }: { onItems: (items: RecognizedItem[]) => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [shows, setShows] = useState<Place>("fridge"); // the person says where the photo is from; the AI doesn't guess
  const [news, setNews] = useState(""); // what a screen reader announces: reading, then what was found
  const input = useRef<HTMLInputElement>(null);
  const photoButton = useRef<HTMLButtonElement>(null);
  const nextId = useRef(1);
  const busy = useRef(false); // set at once, so a double tap can't start two readings
  // False once the screen is left. An answer that arrives later still goes on the list (the person left, they didn't
  // cancel), unless the list was started over; only this screen's own messages and focus are skipped.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const online = useOnline();
  const used = slots.filter((slot) => slot.status !== "error").length; // a failed photo doesn't use up a turn
  const full = used >= MAX_PHOTOS;
  const reading = slots.some((slot) => slot.status === "reading");

  const update = (id: number, patch: Partial<Slot>) =>
    setSlots((all) => all.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));

  async function read(source: () => Promise<Blob>, place: Place = shows) {
    if (busy.current) return;
    busy.current = true;
    const id = nextId.current++;
    const list = currentList();
    try {
      let image: string;
      try {
        image = await shrinkPhoto(await source());
      } catch {
        if (alive.current) {
          const message = navigator.onLine ? "This photo couldn't be opened." : "No connection. Add items by hand.";
          setSlots((all) => [...all, { id, preview: "", status: "error", message }]);
          setNews(message);
        }
        return;
      }
      if (alive.current) {
        setSlots((all) => [...all, { id, preview: image, status: "reading", message: "Looking for food…" }]);
        setNews("Looking for food in the photo…");
      }
      const result = await recognizePhoto(image, place);
      if (list !== currentList()) return;
      if ("error" in result) {
        if (alive.current) {
          update(id, { status: "error", message: result.error });
          setNews(result.error);
        }
        return;
      }
      onItems(result.items);
      if (!alive.current) return;
      const count = result.items.length;
      const message = count ? `Found ${count} item${count === 1 ? "" : "s"}` : "No food found in this photo";
      update(id, { status: "done", message });
      setNews(`${message}.`);
    } finally {
      busy.current = false;
      // The sample button goes away once a photo is in: keep the keyboard on the photo button instead of losing it.
      requestAnimationFrame(() => {
        if (alive.current && (!document.activeElement || document.activeElement === document.body)) photoButton.current?.focus();
      });
    }
  }

  const useSample = () => read(async () => {
    const response = await fetch(SAMPLE_PHOTO);
    if (!response.ok) throw new Error("sample photo missing");
    return response.blob();
  }, "fridge");

  return (
    <div className="photos">
      {slots.length > 0 && (
        <ul className="photo-list">
          {slots.map((slot) => (
            <li key={slot.id} className={`photo photo-${slot.status}`}>
              {slot.preview ? <img src={slot.preview} alt="" /> : <span className="photo-blank" aria-hidden="true" />}
              <span className="photo-message">{slot.message}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="segmented" role="group" aria-label="This photo shows the">
        {(["fridge", "freezer"] as const).map((place) => (
          <button key={place} type="button" aria-pressed={shows === place} onClick={() => setShows(place)}>
            {place === "fridge" ? "Fridge photo" : "Freezer photo"}
          </button>
        ))}
      </div>
      <input ref={input} type="file" accept="image/*" hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(async () => file);
        }} />
      {/* Busy, not disabled, while a photo is read: disabling the focused button would drop the keyboard focus. */}
      <button ref={photoButton} type="button" className={used ? "secondary" : "primary"} aria-disabled={full || reading || undefined}
        onClick={() => { if (!full && !reading) input.current?.click(); }}>
        {used ? "Add another photo" : "Take or choose a photo"}
      </button>
      <p className="visually-hidden" role="status">{news}</p>
      {!online && <p className="notice">You're offline. Photos need a connection; adding food by hand works.</p>}
      <p className="hint">
        {full ? `That's ${MAX_PHOTOS} photos. ` : "Fridge shelves, the door, the freezer: up to three photos. "}
        Photos are only used to find the food and are not saved.
      </p>
      {!used && (
        <button type="button" className="link" aria-disabled={reading || undefined} onClick={() => {
          if (reading) return;
          photoButton.current?.focus(); // this button goes away as soon as the photo is in
          void useSample();
        }}>
          No photo handy? Try a sample fridge (USDA photo)
        </button>
      )}
    </div>
  );
}
