import { useEffect, useRef, useState } from "react";
import { shrinkPhoto } from "../photos";
import type { Place } from "../chart";
import { recognizePhoto, type RecognizedItem } from "../recognize";

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
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const busy = useRef(false); // set at once, so a double tap can't start two readings
  const alive = useRef(true); // false after Start over or leaving the screen: late answers are dropped
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
    try {
      let image: string;
      try {
        image = await shrinkPhoto(await source());
      } catch {
        if (alive.current) {
          setSlots((all) => [...all, { id, preview: "", status: "error",
            message: navigator.onLine ? "This photo couldn't be opened." : "No connection. Add items by hand." }]);
        }
        return;
      }
      if (!alive.current) return;
      setSlots((all) => [...all, { id, preview: image, status: "reading", message: "Looking for food…" }]);
      const result = await recognizePhoto(image, place);
      if (!alive.current) return;
      if ("error" in result) {
        update(id, { status: "error", message: result.error });
        return;
      }
      onItems(result.items);
      const count = result.items.length;
      update(id, { status: "done", message: count ? `Found ${count} item${count === 1 ? "" : "s"}` : "No food found in this photo" });
    } finally {
      busy.current = false;
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
        <ul className="photo-list" aria-live="polite">
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
      <button type="button" className={used ? "secondary" : "primary"} disabled={full || reading} onClick={() => input.current?.click()}>
        {used ? "Add another photo" : "Take or choose a photo"}
      </button>
      {!online && <p className="notice">You're offline. Photos need a connection; adding food by hand works.</p>}
      <p className="hint">
        {full ? `That's ${MAX_PHOTOS} photos. ` : "Fridge shelves, the door, the freezer: up to three photos. "}
        Photos are only used to find the food and are not saved.
      </p>
      {!used && (
        <button type="button" className="link" disabled={reading} onClick={() => void useSample()}>
          No photo handy? Try a sample fridge (USDA photo)
        </button>
      )}
    </div>
  );
}
