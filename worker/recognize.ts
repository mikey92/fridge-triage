// Photo → item list. The model only names the food and picks a chart row; it never judges safety.
import { FREEZER_ROWS, FRIDGE_ROWS, rowById, type Place, type Row } from "../src/chart";

export type RecognizedItem = {
  name: string;
  place: Place;
  row: string | null;
  cut: boolean | null;
  opened: boolean | null;
  sure: boolean;
};

export type RelayEnv = { MODEL: string; EFFORT?: string; RELAY_URL?: string; RELAY_KEY?: string };

const MAX_ITEMS = 60;

const list = (rows: Row[]) => rows.map((row) =>
  `${row.id}: ${row.label}${row.onChart ? "" : " [app rule, not a chart row]"} (for example: ${row.words.slice(0, 6).join(", ")})`).join("\n");

export const INSTRUCTIONS = `You look at one photo of the inside of a home refrigerator or freezer and list the food in it, so a person can check each item against the FoodSafety.gov power-outage charts. You never say whether food is safe; you only name it and pick its chart row. A wrong row can make the app tell someone to keep food that should be thrown out, so when in doubt, say so.

For each distinct food item or container you can see, give:
- name: what it is, the way a person would say it ("carton of eggs", "bag of shredded cheese", "block of cheddar", "container of cut pineapple"). If you can't tell what is in a container, say so ("covered container, contents unclear").
- place: the part of the appliance the person says the photo shows (the message tells you). Crisper, deli and meat drawers are part of the fridge.
- row: the id of the one row below, from the chart for that place, that the item belongs to; null if none fits or you can't tell what it is.
- cut: true for cut, sliced or peeled fresh fruit or vegetables, false for whole ones, null for anything else.
- opened: true or false for jars, bottles, cans, cartons and packages when you can tell, otherwise null.
- sure: true only if you can plainly see what the item is. Set it to false when you are going by color, shape or packaging alone, when the item is wrapped, foil-covered or partly hidden, or when two rows could fit.

Look closely before you name something:
- Read the labels you can see. A package with a "safe handling instructions" label, or the shape of a whole bird or a roast, is raw meat or poultry, whatever color the wrapper is.
- Foil, paper and opaque containers hide what is inside: name only what you can actually see, or say the contents are unclear.
- A package that mixes foods from different rows (a tray of assorted cheeses, a salad kit with dressing) goes under the row of its most perishable food, with sure false.

Skip drinks the charts don't cover (water, soda, beer, wine, sports drinks), non-food (baking soda boxes, odor absorbers), and the appliance itself. List each item once even if it appears twice. At most 40 items.

FRIDGE CHART rows:
${list(FRIDGE_ROWS)}

FREEZER CHART rows:
${list(FREEZER_ROWS)}`;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "place", "row", "cut", "opened", "sure"],
        properties: {
          name: { type: "string" },
          place: { type: "string", enum: ["fridge", "freezer"] },
          row: { type: ["string", "null"] },
          cut: { type: ["boolean", "null"] },
          opened: { type: ["boolean", "null"] },
          sure: { type: "boolean" },
        },
      },
    },
  },
} as const;

const bool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

/** Checks the model's answer: unknown rows become null, a row from the other chart moves to its partner, at most 60 items.
 * The person said which appliance the photo shows, so every item goes there. Rows a photo can't tell apart are never sure. */
export function cleanItems(raw: unknown, shows?: Place): RecognizedItem[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) throw new Error("answer has no items list");
  const out: RecognizedItem[] = [];
  for (const entry of items) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 80) : "";
    if (!name) continue;
    const place: Place = shows ?? (item.place === "freezer" ? "freezer" : "fridge");
    let row = typeof item.row === "string" ? rowById(item.row) : undefined;
    // A row from the other appliance's chart means the model was confused: move it, and never call it sure.
    const crossed = !!row && row.place !== place;
    if (row && crossed) row = rowById(row.move);
    out.push({
      name,
      place,
      row: row && row.place === place ? row.id : null,
      cut: bool(item.cut),
      opened: bool(item.opened),
      sure: item.sure === true && !!row && !crossed && !row.lookAlike,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** Text of a Responses API result: the output_text parts of its message items. */
export function outputText(data: unknown): string {
  const output = (data as { output?: unknown[] })?.output ?? [];
  return output
    .flatMap((item) => {
      const message = item as { type?: string; content?: { type?: string; text?: string }[] };
      return message.type === "message" ? message.content ?? [] : [];
    })
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
}

export async function recognize(image: string, env: RelayEnv, shows: Place = "fridge"): Promise<RecognizedItem[]> {
  if (!env.RELAY_URL || !env.RELAY_KEY) throw new Error("not configured");
  const response = await fetch(`${env.RELAY_URL.replace(/\/$/, "")}/responses`, {
    method: "POST",
    signal: AbortSignal.timeout(40_000),
    headers: {
      "content-type": "application/json",
      "x-relay-key": env.RELAY_KEY,
      "x-relay-collect": "1",
      "user-agent": "fridge-triage/0.1",
    },
    body: JSON.stringify({
      model: env.MODEL,
      reasoning: { effort: env.EFFORT ?? "low" },
      store: false,
      stream: true,
      instructions: INSTRUCTIONS,
      input: [{ role: "user", content: [
        { type: "input_text", text: `List the food in this photo. The person says it shows the ${shows}.` },
        { type: "input_image", image_url: image },
      ] }],
      text: { format: { type: "json_schema", name: "fridge_items", schema: SCHEMA, strict: true } },
    }),
  });
  if (!response.ok) throw new Error(`model relay answered ${response.status}`);
  const text = outputText(await response.json());
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return cleanItems(JSON.parse(json), shows);
}
