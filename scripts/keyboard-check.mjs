// Goes through the core journey with the keyboard only (Tab, Shift-Tab, Enter, Space, typing), recording where focus
// lands after each screen change, how many Tabs each step takes, and whether the focused control shows a focus ring.
// The recognizer is stubbed.   npx vite --port 5176 &   then   node scripts/keyboard-check.mjs [url]
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:5176/";
const FOUND = [
  { name: "carton of milk", place: "fridge", row: "r-milk", cut: null, opened: true, sure: true },
  { name: "container of grapes", place: "fridge", row: "r-fruit-whole", cut: null, opened: null, sure: true },
  { name: "whole oranges", place: "fridge", row: "r-fruit-whole", cut: null, opened: null, sure: true },
];
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
await page.route("**/api/recognize", (route) => route.fulfill({ json: { items: FOUND } }));
let problems = 0;
const focused = () => page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { name: "(body)", ring: false };
  const style = getComputedStyle(el);
  const ring = (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
  const name = el.getAttribute("aria-label") || el.innerText?.trim() || el.getAttribute("placeholder") || el.id || el.tagName;
  return { name: `${el.tagName.toLowerCase()} "${name.replace(/\s+/g, " ").slice(0, 60)}"`, ring };
});
async function tabTo(pattern, label, max = 40) {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press("Tab");
    const f = await focused();
    if (pattern.test(f.name)) {
      if (!f.ring) { problems++; console.log(`  no focus ring on ${f.name}`); }
      console.log(`${label}: ${i} Tab${i > 1 ? "s" : ""} → ${f.name}`);
      return;
    }
  }
  problems++;
  console.log(`${label}: NOT REACHED in ${max} Tabs`);
}
async function landed(label, expect) {
  await page.waitForTimeout(300);
  const f = await focused();
  const ok = expect.test(f.name);
  if (!ok) problems++;
  console.log(`  after ${label}, focus is on ${f.name}${ok ? "" : "  <-- expected " + expect}`);
}

await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await tabTo(/The power is out/, "start the clock");
await page.keyboard.press("Enter");
await landed("starting the clock", /h1 "The power is out"/);
await tabTo(/Change the times/, "change the times");
await page.keyboard.press("Enter");
await landed("opening the outage form", /h1/);
await tabTo(/-start"/, "the start time field");
await tabTo(/Half full/, "freezer half full");
await page.keyboard.press("Space");
await tabTo(/Next: check my food/, "on to the food");
await page.keyboard.press("Enter");
await landed("leaving the outage form", /h1 "Check my food"/);
await tabTo(/Try a sample fridge/, "sample photo");
await page.keyboard.press("Enter");
await page.locator(".photo-done, .photo-error").first().waitFor();
await landed("reading the photo", /.*/);
await tabTo(/input .*(milk, cheddar|Add something)/i, "hand-entry search");
await page.keyboard.type("milk");
await tabTo(/Milk, cream/, "pick the chart row");
await page.keyboard.press("Enter");
await landed("adding milk by hand", /input|Add something|milk/i);
await tabTo(/See what to do/, "see what to do");
await page.keyboard.press("Enter");
await landed("opening the results", /h1 "What to do"/);
await tabTo(/Yes, “container of grapes” is “Fresh fruits, uncut”/, "confirm the grapes");
await page.keyboard.press("Enter");
await landed("confirming", /Yes, “whole oranges” is “Fresh fruits, uncut”/);
await tabTo(/Fix whole oranges/, "fix the oranges");
await page.keyboard.press("Enter");
await landed("opening the editor", /Done fixing whole oranges|Fix|button/);
await tabTo(/Remove “whole oranges”/, "remove it");
await page.keyboard.press("Enter");
await landed("removing", /Fix|h1/);
await tabTo(/Save loss record/, "save the loss record");
await page.keyboard.press("Enter");
await landed("opening the loss record", /h1/);
await browser.close();
console.log(problems ? `${problems} problem(s)` : "keyboard journey ok");
process.exit(problems ? 1 : 0);
