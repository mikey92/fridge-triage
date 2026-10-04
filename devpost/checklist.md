---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (the entrant delegated the build and the hands-on checks to the agent; see `learner-profile.md`)

## Slices

- [x] **1. Add food by hand and see what the chart says to do with it**
  Becomes usable: A running app where you set an outage length, add "shredded cheese" and "cheddar block" from the chart search, and see Toss and Keep, each with its FoodSafety.gov row and the condition that applied.
  Why now: This is the kernel (the chart decides, not the AI), and it needs nothing from the network; everything later feeds items into it. Bootstrapping lives here.
  PRD ref: `prd.md > Verdict rules (the kernel)`, `prd.md > Review and edit`, `prd.md > Without the AI`
  Spec ref: `spec.md > Chart data`, `spec.md > Verdict rules`, `spec.md > Verdict view`, `spec.md > App shell`, `spec.md > File Structure`
  Build: Scaffold Vite + React + TypeScript with the Cloudflare Vite plugin and Vitest; write `src/chart.ts` with every row of both charts word for word; write `src/rules.ts`; a minimal results page with an outage-length input, chart search to add items, fridge/freezer, and the four verdict sections with reasons.
  Verify (mechanical): `npm test` passes rule tests covering every chart row in both columns and the exposure cases in the PRD acceptance criteria; `npm run build` succeeds; in the dev server, shredded cheese and cheddar after 7.5 hours show Toss and Keep with their rows.
  Learner check: Open the app, set the outage to 7½ hours, add shredded cheese, a cheddar block, milk and ketchup, and see which go where and why.
  Commit: `Decide keep or toss from the FoodSafety.gov charts`

- [ ] **2. The cold clock runs during an outage and remembers it**
  Becomes usable: Tap "The power is out", see the fridge and freezer countdowns, close the tab, reopen, and the clock and the item list are still there; tap "The power is back" and the verdicts use the real outage times.
  Why now: The outage facts drive every verdict, and persistence is the first place the data model can be wrong.
  PRD ref: `prd.md > Cold clock`, `prd.md > The Core Journey` (steps 1–3), `prd.md > States and Boundaries`
  Spec ref: `spec.md > Outage store`, `spec.md > Cold clock`, `spec.md > Outage details`, `spec.md > Data Model`
  Build: The reducer with local storage, the home status card, the outage form (start, end, freezer fill, door, thermometers), the cold clock, hash routes, "Start over".
  Verify (mechanical): Unit tests for the clock arithmetic (5 hours ago → fridge past 4 h, freezer 19 h left when half full) pass; in the browser, start an outage, reload, and confirm the countdown continues and the items remain.
  Learner check: Start an outage set to an hour ago, reload the page, and check the clock kept counting.
  Commit: `Add the cold clock and keep the outage on the device`

- [ ] **3. A photo of the fridge becomes the item list**
  Becomes usable: Add a fridge photo and, about twenty seconds later, the food in it appears in the list matched to chart rows, with verdicts.
  Why now: The riskiest external piece (the model relay with images and a JSON schema), checked early and on its own behavior; the kernel is already there to receive it.
  PRD ref: `prd.md > Photo recognition`, `prd.md > The Core Journey` (step 4)
  Spec ref: `spec.md > Photo intake`, `spec.md > Recognizer client`, `spec.md > Recognizer endpoint`, `spec.md > External Services and Dependencies`
  Build: Canvas resize, the client with a 45-second timeout, the Worker route with the rate limit, the model request built from the chart rows, answer validation, the photo slots UI with per-photo status, the sample photo.
  Verify (mechanical): Vitest for answer validation (unknown rows → null, bad places, too many items); one real call with `public/sample-fridge.jpg` through the dev server returns items with valid row ids; with the relay key removed, the page shows the error and manual add still works.
  Learner check: Add the sample photo and compare the list with what is in the picture.
  Commit: `Recognize food in fridge photos`

- [ ] **4. Fix what the AI got wrong in one tap**
  Becomes usable: Change an item's chart row, mark it cut or opened, move it to the freezer, mark ice crystals, remove it, or add a missing item; the verdict changes immediately; unsure matches are flagged.
  Why now: The recognizer will make mistakes; the person correcting it is part of the kernel's promise (unknown never becomes Keep).
  PRD ref: `prd.md > Review and edit`
  Spec ref: `spec.md > Item list`
  Build: Row picker with search over labels and everyday words, cut/opened partner switching, place switch with row pairing, ice toggle, "check the match" flag, remove.
  Verify (mechanical): Rule tests for partner and place switching; in the browser, switching "fresh fruit, cut" to uncut changes Toss to Keep, and moving milk to the freezer with ice crystals gives Refreeze.
  Learner check: Change cut melon to a whole melon and watch the verdict change.
  Commit: `Let people correct items and see verdicts update`

- [ ] **5. Save a dated record of what was thrown out**
  Becomes usable: "Save loss record" opens a print-ready page with the date, outage times and length, the tossed items, and the SNAP note.
  Why now: It finishes the core journey and is the reason someone keeps the result.
  PRD ref: `prd.md > Loss record`
  Spec ref: `spec.md > Loss record`
  Build: The record page and print styles (light theme forced, no navigation).
  Verify (mechanical): Playwright prints the page to PDF and the PDF has no dark background and lists every tossed item.
  Learner check: Open the record and use the browser's print preview.
  Commit: `Add the printable loss record`

- [ ] **6. Anyone can try it: deployed, tested end to end, documented**
  Becomes usable: The app at https://fridge-triage.mikey9220.workers.dev, a README that explains how to run it, and one end-to-end test of the whole journey.
  Why now: Judges need a link and a video; the end-to-end test guards the demo path.
  PRD ref: `prd.md > The Core Journey`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`
  Build: Playwright journey test with the recognizer stubbed; dark/light/phone layout pass; README, LICENSE (MIT), `.dev.vars.example`; wrangler deploy with secrets.
  Verify (mechanical): `npm test`, `npm run e2e` and `npm run build` pass; the deployed URL loads, and a real photo recognized there gives verdicts.
  Learner check: Open the live link on a phone and run the core journey once.
  Commit: `Deploy, test the journey end to end, and document it`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 3 (the first real photo through the whole loop)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

