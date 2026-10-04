// Client for POST /api/recognize.
import type { Place } from "./chart";

export type RecognizedItem = {
  name: string;
  place: Place;
  row: string | null;
  cut: boolean | null;
  opened: boolean | null;
  sure: boolean;
};

export type RecognizeResult = { items: RecognizedItem[] } | { error: string };

export const TIMEOUT_MS = 45_000;

export async function recognizePhoto(image: string): Promise<RecognizeResult> {
  try {
    const response = await fetch("/api/recognize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await response.json().catch(() => ({}))) as { items?: RecognizedItem[]; error?: string };
    if (!response.ok || !Array.isArray(data.items)) {
      return { error: data.error ?? `The server answered ${response.status}. Add items by hand.` };
    }
    return { items: data.items };
  } catch (error) {
    const slow = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { error: slow ? "Reading the photo took too long. Try again, or add items by hand." : "No connection. Add items by hand." };
  }
}
