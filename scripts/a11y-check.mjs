// Runs axe-core (WCAG 2.2 A/AA) on every screen and state of the app, in dark and light mode, phone-sized.
// The recognizer is stubbed, so no model key is needed.
//   npx vite --port 5176 &   then   node scripts/a11y-check.mjs [url]
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";

const url = process.argv[2] ?? "http://localhost:5176/";
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const FOUND = [
  { name: "carton of milk", place: "fridge", row: "r-milk", cut: null, opened: true, sure: true },
  { name: "container of grapes", place: "fridge", row: "r-fruit-whole", cut: null, opened: null, sure: true },
  { name: "block of cheddar", place: "fridge", row: "r-hard-cheese", cut: null, opened: null, sure: false },
  { name: "covered container, contents unclear", place: "fridge", row: null, cut: null, opened: null, sure: false },
  { name: "bag of frozen peas", place: "freezer", row: "f-veg", cut: null, opened: null, sure: true },
];
const local = (ms) => { const d = new Date(Date.now() - ms); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
let failures = 0;
for (const scheme of ["dark", "light"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  await page.route("**/api/recognize", (route) => route.fulfill({ json: { items: FOUND } }));
  const check = async (state) => {
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(() => window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    }));
    const bad = result.violations;
    failures += bad.length;
    console.log(`${scheme.padEnd(5)} ${state.padEnd(22)} ${bad.length ? bad.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(" ")}`).join(" | ") : "ok"}`);
  };
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await check("home");
  await page.getByRole("button", { name: "The power is out" }).click();
  await check("clock running");
  await page.getByRole("button", { name: "Change the times" }).click();
  await page.locator("details").first().evaluate((d) => { d.open = true; });
  await check("outage form");
  await page.getByLabel("The power went out").fill(local(-3 * 3_600_000)); // in the future
  await check("outage form, error");
  await page.getByLabel("The power went out").fill(local(30 * 3_600_000));
  await page.getByRole("button", { name: "Half full" }).click();
  await page.getByRole("link", { name: "Fridge Triage" }).click();
  await page.getByRole("button", { name: "The power is back" }).click();
  await check("check, empty");
  await page.getByRole("button", { name: /Try a sample fridge/ }).click();
  await page.locator(".photo-done, .photo-error").first().waitFor();
  await page.getByLabel("Add something from the fridge").fill("milk");
  await check("check, photo + search");
  await page.getByRole("button", { name: /Milk, cream/ }).click();
  await page.getByRole("button", { name: /See what to do/ }).click();
  await check("results");
  await page.locator(".line").filter({ has: page.getByText("container of grapes", { exact: true }) }).getByRole("button", { name: "Fix" }).click();
  await check("results, editor open");
  await page.getByRole("button", { name: "Change the match" }).first().click().catch(() => {});
  await check("results, row picker");
  await page.getByRole("button", { name: "Save loss record" }).click();
  await check("loss record");
  await page.context().setOffline(true);
  await page.goto(url + "#/check").catch(() => {});
  await page.close();
}
await browser.close();
console.log(failures ? `${failures} violation types found` : "no violations");
process.exit(failures ? 1 : 0);
