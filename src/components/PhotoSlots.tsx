import { useRef, useState } from "react";
import { shrinkPhoto } from "../photos";
import { recognizePhoto, type RecognizedItem } from "../recognize";

type Slot = { id: number; preview: string; status: "reading" | "done" | "error"; message: string };

export const MAX_PHOTOS = 3;
export const SAMPLE_PHOTO = "/sample-fridge.jpg";

/** Up to three photos; each is read once and its items handed to onItems. Photos are kept only in memory. */
export function PhotoSlots({ onItems }: { onItems: (items: RecognizedItem[]) => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const full = slots.length >= MAX_PHOTOS;
  const reading = slots.some((slot) => slot.status === "reading");

  const update = (id: number, patch: Partial<Slot>) =>
    setSlots((all) => all.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));

  async function read(source: Blob) {
    const id = nextId.current++;
    let image: string;
    try {
      image = await shrinkPhoto(source);
    } catch {
      setSlots((all) => [...all, { id, preview: "", status: "error", message: "This photo couldn't be opened." }]);
      return;
    }
    setSlots((all) => [...all, { id, preview: image, status: "reading", message: "Looking for food…" }]);
    const result = await recognizePhoto(image);
    if ("error" in result) {
      update(id, { status: "error", message: result.error });
      return;
    }
    onItems(result.items);
    const count = result.items.length;
    update(id, { status: "done", message: count ? `Found ${count} item${count === 1 ? "" : "s"}` : "No food found in this photo" });
  }

  async function useSample() {
    const response = await fetch(SAMPLE_PHOTO);
    await read(await response.blob());
  }

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
      <input ref={input} type="file" accept="image/*" hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(file);
        }} />
      <button type="button" className="primary" disabled={full} onClick={() => input.current?.click()}>
        {slots.length ? "Add another photo" : "Take or choose a photo"}
      </button>
      <p className="hint">
        {full ? `That's ${MAX_PHOTOS} photos. ` : "Fridge shelves, the door, the freezer: up to three photos. "}
        Photos are only used to find the food and are not saved.
      </p>
      {!slots.length && (
        <button type="button" className="link" disabled={reading} onClick={() => void useSample()}>
          No photo handy? Try a sample fridge (USDA photo)
        </button>
      )}
    </div>
  );
}
