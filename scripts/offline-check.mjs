// Checks the deployed app works with no connection: load it once online, go offline, reload, and run the hand-entry journey.
//   node scripts/offline-check.mjs [url]
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://fridge-triage.mikey9220.workers.dev/";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, colorScheme: "dark" });
const page = await context.newPage();
const step = (text) => console.log(`- ${text}`);

await page.goto(url);
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.reload(); // now controlled by the service worker
step(`online: service worker controls the page: ${await page.evaluate(() => !!navigator.serviceWorker.controller)}`);

await context.setOffline(true);
await page.reload();
step(`offline reload shows: "${await page.locator("h1").first().innerText()}"`);
await page.getByRole("button", { name: "The power is out" }).click();
step(`cold clock: ${(await page.locator(".clock-grid").innerText()).replace(/\s+/g, " ")}`);
await page.getByRole("button", { name: "Check my food now" }).click();
step(`offline notice: ${await page.locator(".notice").first().innerText()}`);
const box = page.getByLabel("Add something from the fridge");
await box.fill("milk");
await page.getByRole("button", { name: /Milk, cream/ }).click();
await page.getByRole("button", { name: /See what to do/ }).click();
const verdict = (await page.locator(".line").first().innerText()).replace(/\s+/g, " ");
step(`verdict: ${verdict}`);
if (!/Power out \d+ min: a closed fridge keeps food safe/.test(verdict)) throw new Error("expected a Keep verdict for milk minutes into the outage");
await page.screenshot({ path: "offline-check.png" });
await browser.close();
