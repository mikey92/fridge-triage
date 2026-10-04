---
doc: prd
status: approved
---

# Fridge Triage — Product Requirements

A phone-first web app for someone whose power went out: it keeps the cold clock while the power is off, then turns photos of the fridge and freezer into a keep-or-toss list decided by the FoodSafety.gov charts, and a dated record of what was thrown out.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
1. **Arrive.** The home screen asks one thing: is the power out now, or is it back? Two large buttons: "The power is out" and "The power is back: check my food". A line under them says where the rules come from.
2. **Power out.** They confirm when it went out (now, or a time earlier today) and how full the freezer is (full, half, not sure). The cold clock shows two countdowns: fridge (4 hours from the start) and freezer (48 hours if full, 24 if half full or not sure), with the three USDA tips that matter now (keep the doors closed, a fridge thermometer helps, move food to a cooler with ice if it will be longer than 4 hours). Closing and reopening the app keeps the clock.
3. **Power back.** They tap "The power is back" (or "Check my food" at any time, which evaluates at the current time). They confirm the start and end times, and optionally: a fridge thermometer reading, a freezer thermometer reading, and whether the fridge door stayed mostly closed.
4. **Photos.** They add one to three photos (camera or gallery): fridge shelves, the door, the freezer. Each photo is sent once to the recognizer, which returns the food it can see, matched to a chart row, with "cut" or "opened" guesses. "Add items by hand" is always available instead.
5. **Review.** The items appear grouped as Fridge and Freezer. They can remove an item, change its chart row, toggle cut/opened, move it between fridge and freezer, mark "still has ice crystals" for freezer items, and add missing items by searching the chart.
6. **Verdicts.** Every item gets Toss, Check, Refreeze or Keep, sorted in that order, each with one line of reason quoting its chart row and the condition that applied ("above 40°F for more than 2 hours"). Toss and Check items have a tick box for clearing the shelves.
7. **Loss record.** "Save loss record" opens a printable page: today's date, outage start, end and length, every tossed item, and a short note that SNAP households can ask for replacement benefits within 10 days of an outage of 4+ hours (with a link to find their state office). They print it or save it as PDF from the browser.

## Screens and Layout
- **Home**: the status card (no outage / power out with the cold clock / power back) and the two actions.
- **Outage details**: a sheet with start and end times, freezer fullness, door closed, thermometer readings. Reached from Home and from the verdict screen header.
- **Check my food**: photo slots (up to three) with a "Find food" button, and "Add items by hand".
- **Results**: one scrolling page: a summary bar (counts per verdict, outage length), the Toss / Check / Refreeze / Keep sections, the editable item list, "Add an item", "Save loss record".
- **Loss record**: a print-styled page with a Back link.

## Look and Feel
- Dark by default for reading by flashlight and saving battery; a light theme follows the system setting and is always used for printing.
- Verdict colours, all with text labels so colour is never the only signal: Toss red, Check amber, Refreeze blue, Keep green.
- Large type (18 px body), generous tap targets (at least 44 px), digits for the clock in a monospace face.
- Plain, calm copy in short sentences. No cartoon food, no emoji, no chat bubbles. Source: `scope.md > Inspiration & Identity`.

## Features and Behavior

### Cold clock
- Starting an outage stores the start time and freezer fullness on the device.
- Fridge: counts down 4 hours from the start ("keeps food safe for about 4 hours if the door stays closed"). After 4 hours it reads "Past 4 hours: perishable fridge food needs checking".
- Freezer: counts down 48 hours (full) or 24 hours (half full or not sure).
- "The power is back" stores the end time and opens Check my food.
- [ ] Reloading the page during an outage shows the same countdowns.
- [ ] A start time of 5 hours ago shows the fridge past its 4 hours and the freezer with 19 hours left (half full).

### Photo recognition
- Up to three photos, each shrunk in the browser to at most 1280 px on the long side before upload.
- The recognizer returns, per item: the name as seen ("bag of shredded cheese"), a chart row id or "none", where it is (fridge or freezer, guessed from the photo), cut/opened when it can tell, and a confidence (high/low).
- Low-confidence items are marked "check the match"; items with no row go straight to Check.
- Photos are not stored anywhere after recognition.
- [ ] A fridge photo with milk, eggs, a cheddar block and shredded cheese returns those four with the right rows.
- [ ] If the recognizer fails or takes more than 45 seconds, the page says so and offers "Add items by hand"; nothing already on the list is lost.

### Review and edit
- Remove, change chart row (searchable list of every row in both charts), toggle cut, toggle opened, switch fridge/freezer, toggle "still has ice crystals" (freezer only).
- "Add an item" searches the chart rows by everyday words ("yogurt" finds "Milk, cream, sour cream, buttermilk, evaporated milk, yogurt, eggnog, soy milk").
- [ ] Changing a row or a toggle updates the verdict immediately.

### Verdict rules (the kernel)
The verdict never comes from the AI. It comes from the chart row, the location and the outage facts:
- **Fridge, thermometer at 40°F or below when the power came back** → Keep (the chart only applies to food above 40°F for more than 2 hours).
- **Fridge, power out 4 hours or less, door mostly closed, no thermometer** → Keep, with "the fridge keeps food safe for up to 4 hours with the door closed".
- **Fridge, door opened often, out 2 hours or less** → Keep; between 2 and 4 hours → the chart column applies, since the 4-hour assurance assumes a closed door.
- **Fridge, otherwise** → the chart's "above 40°F for more than 2 hours" column: Discard → Toss, Keep → Keep.
- **Mayonnaise, tartar sauce, horseradish (opened)** → Keep if the outage was under 8 hours; otherwise Check: "toss if it was above 50°F for more than 8 hours".
- **Rows that depend on cut/opened** (fresh fruit, fresh vegetables, opened juices, canned goods, baby formula, spaghetti sauce): the flag picks the row; an unopened can or jar is shelf-stable → Keep.
- **Freezer, within its hold time (48 h full, 24 h half or not sure)** → Keep ("still frozen").
- **Freezer, past its hold time, or thermometer above 40°F** → per item: "still has ice crystals or feels fridge-cold" (or freezer thermometer 40°F or below) uses the chart's first column (Refreeze, or Discard for ice cream); otherwise the second column. Vegetables past their hold time without ice crystals → Toss if the outage ran more than 6 hours past the hold time, else Check.
- **No chart row** → Check: "Not on the FoodSafety.gov chart. When in doubt, throw it out."
- [ ] Shredded cheese after a 7.5-hour outage → Toss; cheddar block → Keep; each reason names its row.
- [ ] Ice cream in a freezer past its hold time with ice crystals → Toss (the chart discards it either way).

### Loss record
- Lists tossed items with where they were, the outage times and length, and the date the record was made.
- [ ] The page prints on one or two letter-size pages with no dark background.

### Without the AI
- The clock, manual adding, editing, verdicts and the loss record all work with no recognizer at all.

## States and Boundaries
- **First use** — no outage stored: Home shows the two actions.
- **Outage in progress** — Home shows the cold clock; reopening keeps it.
- **Power back** — Home shows the outage length and "Check my food".
- **Recognizing** — photo slots show progress; the list fills in as each photo returns.
- **Recognizer unavailable** — a plain message and "Add items by hand"; the rest of the app still works.
- **Empty list** — "No items yet. Add a photo or add items by hand."
- **What persists** — outage times, freezer fullness and the current item list stay on this device (local storage) until "Start over". Photos never persist.
- **Not medical or legal advice** — a one-line note on the results and record pages: guidance from FoodSafety.gov; when in doubt, throw it out.

## Product Decisions
Decisions were delegated to the agent by the entrant (`learner-profile.md`); each is the agent's call with its reason.
- The AI recognizes; the chart decides — food-safety mistakes make people sick, and the official chart is short enough to encode exactly.
- Unknown means Check, never Keep — the USDA rule is "when in doubt, throw it out".
- No accounts, no stored photos — an outage is a one-off moment and fridge photos are private.
- Dark by default — people read it by flashlight with a phone they need to keep charged.
- A printable loss record instead of a form filler — SNAP and insurance forms differ by state and company; a dated list is what all of them need.

## What We're Building
The cold clock; outage details; up to three photos recognized into chart-matched items; full editing; the verdict rules for every row of both charts; the verdict page with reasons and tick boxes; the printable loss record; manual mode without the AI; a phone-friendly dark/light layout.

## Deferred From the POC
- Estimated replacement value per item — needs prices that vary by store and region.
- Several appliances at once — the POC keeps one fridge and one freezer.
- Push notifications for the clock — needs service-worker push and permissions; the countdown on screen is enough to prove the loop.

## Possible Later Enhancements
- Spanish and other languages, since outages hit every community.
- Offline install (PWA) so the clock and rules open with no signal.
- Barcode lookup to name packaged food without a photo match.

## Non-Goals
- Judging spoilage by look, smell or dates — the charts don't, and USDA says never to taste food to check.
- Commercial kitchens — different code.
- Storing history across outages — not needed to prove the loop.

## Open Questions
- None blocking `4-spec`. To check during the build: how well the recognizer tells a block of cheese from shredded cheese in a photo (the demo's key moment).
