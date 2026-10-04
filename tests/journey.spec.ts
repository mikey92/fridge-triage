import { expect, test, type Page } from "@playwright/test";

// The whole core journey: outage → photo (recognizer stubbed) → verdicts → a fix → loss record → reload.
const FOUND = [
  { name: "carton of milk", place: "fridge", row: "r-milk", cut: null, opened: true, sure: true },
  { name: "bag of shredded cheese", place: "fridge", row: "r-shredded-cheese", cut: null, opened: true, sure: true },
  { name: "block of cheddar", place: "fridge", row: "r-hard-cheese", cut: null, opened: null, sure: true },
  { name: "container of cut melon", place: "fridge", row: "r-fruit-cut", cut: true, opened: null, sure: true },
  { name: "covered container, contents unclear", place: "fridge", row: null, cut: null, opened: null, sure: false },
  { name: "tub of ice cream", place: "freezer", row: "f-ice-cream", cut: null, opened: true, sure: true },
];

const section = (page: Page, name: string) =>
  page.locator(".verdict-group").filter({ has: page.getByText(name, { exact: true }) }).locator("h2 .tag");

test("an outage, a photo, verdicts from the chart, a fix, and the loss record", async ({ page }) => {
  await page.route("**/api/recognize", (route) => route.fulfill({ json: { items: FOUND } }));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "The power is out" }).click();
  await expect(page.getByText("Fridge", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Change the times" }).click();
  const start = new Date(Date.now() - 7.5 * 3_600_000);
  const local = new Date(start.getTime() - start.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel("The power went out").fill(local);
  await page.getByRole("button", { name: "Half full" }).click();
  await page.goto("/#/");
  await page.getByRole("button", { name: "The power is back" }).click();

  await page.getByRole("button", { name: /Try a sample fridge/ }).click();
  await expect(page.getByText("Found 6 items")).toBeVisible();
  await page.getByRole("button", { name: /See what to do with 6 items/ }).click();

  await expect(section(page, "carton of milk")).toHaveText("Toss");
  await expect(section(page, "bag of shredded cheese")).toHaveText("Toss");
  await expect(section(page, "container of cut melon")).toHaveText("Toss");
  await expect(section(page, "covered container, contents unclear")).toHaveText("Check");
  // The AI's match never keeps food on its own: the person confirms it first.
  await expect(section(page, "block of cheddar")).toHaveText("Confirm");
  await expect(section(page, "tub of ice cream")).toHaveText("Confirm");
  await expect(page.getByText("Chart: “Shredded cheeses”", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Yes, “block of cheddar” is right" }).click();
  await expect(section(page, "block of cheddar")).toHaveText("Keep");
  await expect(page.getByRole("button", { name: "Yes, “tub of ice cream” is right" })).toBeFocused();

  const melon = page.locator(".line").filter({ has: page.getByText("container of cut melon", { exact: true }) });
  await melon.getByRole("button", { name: "Fix" }).click();
  await melon.getByRole("button", { name: "Whole" }).click();
  await expect(section(page, "container of cut melon")).toHaveText("Confirm");
  await page.locator(".line").filter({ has: page.getByText("container of cut melon", { exact: true }) })
    .locator(".editor").getByRole("button", { name: "Yes, that's right" }).click();
  await expect(section(page, "container of cut melon")).toHaveText("Keep");

  await page.getByRole("button", { name: "Save loss record" }).click();
  const rows = page.locator(".record-table tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("carton of milk");
  await expect(rows.nth(1)).toContainText("bag of shredded cheese");
  await expect(page.locator(".record")).toContainText(/7 h 3\d min/);

  await page.reload();
  await expect(page.locator(".record-table tbody tr")).toHaveCount(2);
});

test("without the recognizer, the photo says so and adding by hand still works", async ({ page }) => {
  await page.route("**/api/recognize", (route) => route.fulfill({ status: 503, json: { error: "Photo recognition isn't set up here. Add items by hand." } }));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/#/check");
  await page.reload();
  await page.getByRole("button", { name: /Try a sample fridge/ }).click();
  await expect(page.getByText("Photo recognition isn't set up here. Add items by hand.")).toBeVisible();
  await page.getByLabel("Add something from the fridge").fill("deli turkey");
  await page.getByRole("button", { name: /Lunchmeats/ }).click();
  await expect(page.getByText("1 item so far: deli turkey")).toBeVisible();
});
