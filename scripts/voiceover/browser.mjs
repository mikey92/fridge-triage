// Opens the app in a toolbar-less Chrome app window for a VoiceOver run, with the recognizer stubbed, and keeps it
// open until stopped. Prints the browser's process id for vo-run.sh front:<pid>.
//   npx vite --port 5176 &   node scripts/voiceover/browser.mjs [url]
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";

const url = process.argv[2] ?? "http://localhost:5176/";
const PROFILE = "/tmp/fridge-triage-vo-profile";
const FOUND = [
  { name: "carton of milk", place: "fridge", row: "r-milk", cut: null, opened: true, sure: true },
  { name: "container of grapes", place: "fridge", row: "r-fruit-whole", cut: null, opened: null, sure: true },
  { name: "block of cheddar", place: "fridge", row: "r-hard-cheese", cut: null, opened: null, sure: false },
  { name: "covered container, contents unclear", place: "fridge", row: null, cut: null, opened: null, sure: false },
];
execSync(`rm -rf ${PROFILE}`);
const context = await chromium.launchPersistentContext(PROFILE, {
  channel: "chrome", headless: false, viewport: null,
  ignoreDefaultArgs: ["--enable-automation"],
  args: [`--app=${url}`, "--window-size=520,1000", "--window-position=40,40", "--no-first-run", "--no-default-browser-check"],
});
await context.route("**/api/recognize", async (route) => {
  await new Promise((done) => setTimeout(done, 2500)); // long enough to hear "Looking for food…"
  await route.fulfill({ json: { items: FOUND } });
});
let page = context.pages().find((p) => p.url().startsWith(url));
for (let i = 0; !page && i < 50; i++) {
  await new Promise((done) => setTimeout(done, 200));
  page = context.pages().find((p) => p.url().startsWith(url));
}
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.bringToFront();
await page.locator("main h1").focus();
const pid = execSync(`pgrep -f -o "user-data-dir=${PROFILE}"`).toString().trim();
console.log(`pid ${pid}`);
process.on("SIGTERM", async () => { await context.close(); process.exit(0); });
await new Promise(() => {});
