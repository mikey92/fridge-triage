// Draws the app icons (PNG) from public/favicon.svg: 192, 512, a maskable 512 with padding, and the 180 px Apple touch icon.
//   node scripts/icons.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = `data:image/svg+xml;base64,${readFileSync("public/favicon.svg").toString("base64")}`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
const page = await browser.newPage();
const draw = async (size, pad, file) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0e1013;overflow:hidden">
    <img src="${svg}" style="position:absolute;left:${pad}px;top:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px"></body></html>`);
  await page.waitForFunction(() => document.images[0]?.complete);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `public/${file}` });
};
await draw(192, 16, "icon-192.png");
await draw(512, 40, "icon-512.png");
await draw(512, 110, "icon-maskable-512.png");
await draw(180, 16, "apple-touch-icon.png");
await browser.close();
console.log("icons written");
