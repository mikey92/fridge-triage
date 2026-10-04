// Scores saved recognizer runs against the hand labels, through the app's own verdict rules.
//   npx tsx eval/score.ts eval/runs/v3-gpt-5.5-low [more run folders...]      (SET=held-out for the held-out photos)
// For each answer: which labeled item it is (eval/judged.json), whether its row is one of the right ones,
// and what the app would tell the person after a 7½-hour outage (doors mostly closed, freezer half full):
//   shown        the call the app shows as soon as the photo is read, before the person does anything;
//   if confirmed the call after the person taps "Yes, that's right" on the AI's match without looking closely.
// The key numbers: toss-worthy food the app shows as Keep or Refreeze (must be 0), and toss-worthy food whose AI match
// would keep it if confirmed (the cases only the person's look can catch).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rowById } from "../src/chart";
import { verdict, type Call, type Item, type Outage } from "../src/rules";

type Label = { id: string; what: string; rows?: (string | null)[]; ambiguous?: boolean; unclear?: boolean };
type Photo = { set: string; items: Label[] };
type Answer = { name: string; place: "fridge" | "freezer"; row: string | null; cut: boolean | null; opened: boolean | null; sure: boolean };

const labels: Record<string, Photo> = JSON.parse(readFileSync("eval/labels.json", "utf8")).photos;
const judged: Record<string, Record<string, string>> = JSON.parse(readFileSync("eval/judged.json", "utf8"));
const NOW = Date.parse("2026-10-04T21:30:00Z");
const OUTAGE: Outage = {
  start: new Date(NOW - 7.5 * 3_600_000).toISOString(), end: new Date(NOW).toISOString(),
  freezerFill: "half", doorClosed: true, fridgeTempF: null, freezerTempF: null,
};
const item = (fields: Partial<Item> & Pick<Item, "row" | "place">): Item =>
  ({ id: "x", name: "x", cut: null, opened: null, ice: false, sure: true, confirmed: true, from: "photo", cleared: false, ...fields });
const callOf = (fields: Partial<Item> & Pick<Item, "row" | "place">): Call => verdict(item(fields), OUTAGE, NOW).call;
const truthCall = (label: Label): Call => callOf({ row: label.rows?.[0] ?? null, place: "fridge", from: "hand" });
const kept = (call: Call) => call === "keep" || call === "refreeze";
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");

const set = process.env.SET ?? "tune";
const unmapped = new Set<string>();
for (const dir of process.argv.slice(2)) {
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
  const s = { runs: 0, failed: 0, seconds: 0, answers: 0, extra: 0, labeled: 0, found: 0, scored: 0, rightRow: 0,
    toss: 0, tossShownKept: 0, tossTossed: 0, tossMatchKept: 0,
    keep: 0, keepWaiting: 0, keepKept: 0, keepTossed: 0,
    offChart: 0, offChartShownKept: 0, offChartMatchKept: 0, unclear: 0, unclearShownKept: 0, unclearMatchKept: 0 };
  const cases: string[] = [];
  for (const file of files) {
    const run = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    const photo = run.photo.replace(/\.jpg$/, "");
    const truth = labels[photo];
    if (!truth || truth.set !== set) continue;
    s.runs++;
    s.seconds += run.seconds;
    if (!run.items) { s.failed++; continue; }
    const seen = new Set<string>();
    for (const answer of run.items as Answer[]) {
      s.answers++;
      const id = judged[photo]?.[answer.name];
      if (!id) { unmapped.add(`${photo} | ${answer.name}`); continue; }
      if (id === "ignore") continue;
      if (id === "extra") { s.extra++; continue; }
      const label = truth.items.find((l) => l.id === id);
      if (!label) { unmapped.add(`${photo} | ${answer.name} -> unknown label ${id}`); continue; }
      seen.add(id);
      // Runs saved before the look-alike rule existed get it applied here, as the Worker does now.
      const sure = answer.sure && !rowById(answer.row)?.lookAlike;
      const fields = { name: answer.name, row: answer.row, place: answer.place, cut: answer.cut, opened: answer.opened, sure };
      const shown = callOf({ ...fields, confirmed: false });
      const ifConfirmed = callOf({ ...fields, confirmed: true });
      const line = (what: string) => `${photo}: ${what} → "${answer.name}" [${answer.place} ${answer.row}${sure ? "" : ", unsure"}]`;
      if (label.unclear) {
        s.unclear++;
        if (kept(shown)) { s.unclearShownKept++; cases.push(`SHOWN KEEP ${line("(contents unclear)")} → ${shown}`); }
        else if (kept(ifConfirmed)) { s.unclearMatchKept++; cases.push(`keep if confirmed: ${line("(contents unclear)")}`); }
        continue;
      }
      if (label.ambiguous) continue;
      s.scored++;
      if (label.rows?.includes(answer.row) && answer.place === "fridge") s.rightRow++;
      const should = truthCall(label);
      if (should === "toss") {
        s.toss++;
        if (shown === "toss") s.tossTossed++;
        if (kept(shown)) { s.tossShownKept++; cases.push(`SHOWN KEEP ${line(label.what)} → ${shown}`); }
        else if (kept(ifConfirmed)) { s.tossMatchKept++; cases.push(`keep if confirmed: ${line(label.what)}`); }
      } else if (should === "check") {
        s.offChart++;
        if (kept(shown)) { s.offChartShownKept++; cases.push(`SHOWN KEEP ${line(label.what)} → ${shown}`); }
        else if (kept(ifConfirmed)) { s.offChartMatchKept++; cases.push(`keep if confirmed: ${line(label.what)}`); }
      } else {
        s.keep++;
        if (kept(shown)) s.keepKept++;
        else if (shown === "toss") s.keepTossed++;
        else if (kept(ifConfirmed)) s.keepWaiting++;
      }
    }
    const findable = truth.items.filter((l) => !l.unclear);
    s.labeled += findable.length;
    s.found += findable.filter((l) => seen.has(l.id)).length;
  }
  console.log(`\n## ${dir} (${set}, ${s.runs} runs${s.failed ? `, ${s.failed} failed` : ""}, avg ${(s.seconds / Math.max(1, s.runs)).toFixed(1)} s)`);
  console.log(`answers ${s.answers} · items found ${pct(s.found, s.labeled)} (${s.found}/${s.labeled}) · right row ${pct(s.rightRow, s.scored)} (${s.rightRow}/${s.scored}) · extra ${s.extra}`);
  console.log(`toss-worthy ${s.toss}: shown as keep/refreeze ${s.tossShownKept} · tossed ${s.tossTossed} · keep if a wrong match is confirmed ${s.tossMatchKept}`);
  console.log(`keep-worthy ${s.keep}: kept ${s.keepKept} · waiting for a Yes ${s.keepWaiting} · tossed ${s.keepTossed} · check ${s.keep - s.keepKept - s.keepWaiting - s.keepTossed}`);
  console.log(`not on the chart ${s.offChart}: shown as keep ${s.offChartShownKept}, keep if confirmed ${s.offChartMatchKept} · contents unclear ${s.unclear}: shown as keep ${s.unclearShownKept}, keep if confirmed ${s.unclearMatchKept}`);
  for (const line of cases) console.log(`  - ${line}`);
}
if (unmapped.size) {
  console.log(`\nNot judged yet (${unmapped.size}):`);
  for (const line of unmapped) console.log(`  ${line}`);
}
