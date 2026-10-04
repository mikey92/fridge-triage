// Runs the photo recognizer on every photo in eval/photos and saves each answer under eval/runs/<tag>/.
// Uses the same request as the Worker (worker/recognize.ts). Needs RELAY_URL and RELAY_KEY in .dev.vars.
//   npm run eval:run                       # MODEL=gpt-5.5, 2 runs per photo of the tuning set
//   MODEL=gpt-6.1-sol RUNS=2 SET=held-out TAG=... npm run eval:run
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { recognize } from "../worker/recognize";

const vars = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const env = { MODEL: process.env.MODEL ?? "gpt-5.5", EFFORT: process.env.EFFORT, RELAY_URL: vars.RELAY_URL, RELAY_KEY: vars.RELAY_KEY };
const runs = Number(process.env.RUNS ?? 2);
const set = process.env.SET ?? "tune";
const labels: Record<string, { set: string }> = JSON.parse(readFileSync("eval/labels.json", "utf8")).photos;
const tag = process.env.TAG ?? `${env.MODEL}-${env.EFFORT ?? "low"}`;
const dir = `eval/runs/${tag}`;
mkdirSync(dir, { recursive: true });
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

for (const photo of readdirSync("eval/photos").filter((name) => name.endsWith(".jpg") && labels[name.slice(0, -4)]?.set === set).sort()) {
  const image = `data:image/jpeg;base64,${readFileSync(`eval/photos/${photo}`).toString("base64")}`;
  for (let run = 1; run <= runs; run++) {
    const out = `${dir}/${photo.replace(/\.jpg$/, "")}-${run}.json`;
    if (existsSync(out)) continue;
    const started = Date.now();
    let items: unknown = null;
    let error: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        items = await recognize(image, env, "fridge"); // every eval photo shows the fridge
        error = null;
        break;
      } catch (failure) {
        error = failure instanceof Error ? failure.message : String(failure);
        await sleep(8000 * attempt);
      }
    }
    const seconds = (Date.now() - started) / 1000;
    writeFileSync(out, JSON.stringify({ photo, run, model: env.MODEL, effort: env.EFFORT ?? "low", seconds, error, items }, null, 1));
    console.log(photo, run, error ?? `${(items as unknown[]).length} items`, `${seconds.toFixed(1)} s`);
  }
}
