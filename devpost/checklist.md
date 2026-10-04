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

- [x] **2. The cold clock runs during an outage and remembers it**
  Becomes usable: Tap "The power is out", see the fridge and freezer countdowns, close the tab, reopen, and the clock and the item list are still there; tap "The power is back" and the verdicts use the real outage times.
  Why now: The outage facts drive every verdict, and persistence is the first place the data model can be wrong.
  PRD ref: `prd.md > Cold clock`, `prd.md > The Core Journey` (steps 1–3), `prd.md > States and Boundaries`
  Spec ref: `spec.md > Outage store`, `spec.md > Cold clock`, `spec.md > Outage details`, `spec.md > Data Model`
  Build: The reducer with local storage, the home status card, the outage form (start, end, freezer fill, door, thermometers), the cold clock, hash routes, "Start over".
  Verify (mechanical): Unit tests for the clock arithmetic (5 hours ago → fridge past 4 h, freezer 19 h left when half full) pass; in the browser, start an outage, reload, and confirm the countdown continues and the items remain.
  Learner check: Start an outage set to an hour ago, reload the page, and check the clock kept counting.
  Commit: `Add the cold clock and keep the outage on the device`

- [x] **3. A photo of the fridge becomes the item list**
  Becomes usable: Add a fridge photo and, about twenty seconds later, the food in it appears in the list matched to chart rows, with verdicts.
  Why now: The riskiest external piece (the model relay with images and a JSON schema), checked early and on its own behavior; the kernel is already there to receive it.
  PRD ref: `prd.md > Photo recognition`, `prd.md > The Core Journey` (step 4)
  Spec ref: `spec.md > Photo intake`, `spec.md > Recognizer client`, `spec.md > Recognizer endpoint`, `spec.md > External Services and Dependencies`
  Build: Canvas resize, the client with a 45-second timeout, the Worker route with the rate limit, the model request built from the chart rows, answer validation, the photo slots UI with per-photo status, the sample photo.
  Verify (mechanical): Vitest for answer validation (unknown rows → null, bad places, too many items); one real call with `public/sample-fridge.jpg` through the dev server returns items with valid row ids; with the relay key removed, the page shows the error and manual add still works.
  Learner check: Add the sample photo and compare the list with what is in the picture.
  Commit: `Recognize food in fridge photos`

- [x] **4. Fix what the AI got wrong in one tap**
  Becomes usable: Change an item's chart row, mark it cut or opened, move it to the freezer, mark ice crystals, remove it, or add a missing item; the verdict changes immediately; unsure matches are flagged.
  Why now: The recognizer will make mistakes; the person correcting it is part of the kernel's promise (unknown never becomes Keep).
  PRD ref: `prd.md > Review and edit`
  Spec ref: `spec.md > Item list`
  Build: Row picker with search over labels and everyday words, cut/opened partner switching, place switch with row pairing, ice toggle, "check the match" flag, remove.
  Verify (mechanical): Rule tests for partner and place switching; in the browser, switching "fresh fruit, cut" to uncut changes Toss to Keep, and moving milk to the freezer with ice crystals gives Refreeze.
  Learner check: Change cut melon to a whole melon and watch the verdict change.
  Commit: `Let people correct items and see verdicts update`

- [x] **5. Save a dated record of what was thrown out**
  Becomes usable: "Save loss record" opens a print-ready page with the date, outage times and length, the tossed items, and the SNAP note.
  Why now: It finishes the core journey and is the reason someone keeps the result.
  PRD ref: `prd.md > Loss record`
  Spec ref: `spec.md > Loss record`
  Build: The record page and print styles (light theme forced, no navigation).
  Verify (mechanical): Playwright prints the page to PDF and the PDF has no dark background and lists every tossed item.
  Learner check: Open the record and use the browser's print preview.
  Commit: `Add the printable loss record`

- [x] **6. Anyone can try it: deployed, tested end to end, documented**
  Becomes usable: The app at https://fridge-triage.mikey9220.workers.dev, a README that explains how to run it, and one end-to-end test of the whole journey.
  Why now: Judges need a link and a video; the end-to-end test guards the demo path.
  PRD ref: `prd.md > The Core Journey`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`
  Build: Playwright journey test with the recognizer stubbed; dark/light/phone layout pass; README, LICENSE (MIT), `.dev.vars.example`; wrangler deploy with secrets.
  Verify (mechanical): `npm test`, `npm run e2e` and `npm run build` pass; the deployed URL loads, and a real photo recognized there gives verdicts.
  Learner check: Open the live link on a phone and run the core journey once.
  Commit: `Deploy, test the journey end to end, and document it`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 3 (the first real photo through the whole loop). Run by the agent on the entrant's behalf, since the entrant delegated hands-on checks: the USDA sample photo gave 26 items in about 17 s; feedback acted on: the photo button turns secondary once a photo is in, so "See what to do" is the one primary action.
- [x] Final kick-the-tires exploration and feedback completed — by the agent on the deployed app (phone-sized Chrome, dark and light, desktop width): photo → verdicts → fix → loss record → print preview; recognizer-off fallback.

## Final Review

- [x] Final review complete — no open issues from the agent's review; the entrant delegated the ship decision to the agent.

## Code Tour and App Map

- [x] Learning activity complete — brief recap (the entrant delegated the build; no live tour)
- [x] Optional edit and transfer reflection addressed — not applicable (delegated build)
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: recap of the spec's one uncertainty (shredded vs block cheese) and its result in slice 3; rules covered by `tests/rules.test.ts` (every row of both charts).
Route and stops: reference route in the map only — `src/chart.ts` ("r-shredded-cheese", "r-hard-cheese") → `src/rules.ts` `verdict()`/`fridgeVerdict()` → `src/components/Verdicts.tsx` `VerdictLine`.
Edit outcome: not applicable.
Reflection: not offered (delegated build).
Activity mode: recap; map checked in Chrome with scripts disabled.

## Revisions

- [x] **R1. Every verdict checked line by line against the chart**
  Becomes usable: Verdicts that match FoodSafety.gov in the cases the first version got wrong or overstated: a freezer hold time is counted only when the freezer was full or half full with the doors closed (otherwise each item says to check for ice crystals); a freezer still at 0°F keeps; a fridge thermometer only ever makes a call stricter; opened mayonnaise is tossed past 8 hours above 50°F; outage times that don't add up give Check, never a verdict; the app's partner rows say "not a chart row". Fridge photo / Freezer photo choice, °F/°C entry with range checks, saved state that survives bad or blocked storage, keyboard focus kept through fixes.
  Why now: A food-safety app has to be right where the chart is subtle; a review of the first version found calls the chart doesn't support.
  Build: `src/rules.ts` rewritten, `src/chart.ts` words and moves corrected, `src/store.ts` validation, outage form checks, error boundary.
  Verify (mechanical): `npm test` (rules, clock, storage), `npm run e2e`, `npm run typecheck`.
  Commit: `Check every verdict against the chart, work offline, and measure the photo reading`

- [x] **R2. Opens with no connection**
  Becomes usable: After one visit the app opens offline (home-screen install, service worker): the clock, hand entry, verdicts and loss record work during the outage itself; only photo reading needs the network.
  Why now: The moment the app is needed is the moment Wi-Fi is down.
  Build: `public/sw.js`, web manifest and icons, `scripts/offline-check.mjs`.
  Verify (mechanical): `node scripts/offline-check.mjs` loads the live site, cuts the network, reloads, and runs the hand-entry journey.
  Commit: same as R1

- [x] **R3. Photo reading measured, and a photo never keeps food on its own**
  Becomes usable: Every item from a photo that the chart would keep or refreeze shows as Confirm until the person taps Yes or fixes it; cheeses and butter carry a look-alike warning; the person says which appliance each photo shows.
  Why now: Measuring the first version on 13 hand-labeled USDA photos showed it told people to keep 14 of 76 toss-worthy items (raw chicken read as freezer food, guesses it marked unsure).
  Build: `eval/` (photos, labels, judgments, runs, `score.ts`, `first-version.sh`, `EVAL.md`), rewritten recognizer prompt, `confirmed` on items, the Confirm group in the verdict list.
  Verify (mechanical): `npx tsx eval/score.ts eval/runs/v2-gpt-5.5-low` (and `SET=held-out`): 0 of 84 toss-worthy answers shown as Keep; `sh eval/first-version.sh` reproduces the first version's 14 of 76.
  Commit: same as R1
- [x] **R4. Second review: the confirm step names the matched row, one set of time rules, accessibility checked with a screen reader**
  Becomes usable: Confirm says which chart row the AI matched ("It matched this to “Fresh fruits, uncut”"), so a wrong match reads as wrong; the cold clock and the verdicts agree on opened doors and thermometer readings; the loss record includes Check items ticked as thrown out; the app works with VoiceOver and the keyboard alone.
  Why now: Independent code reviews and a real VoiceOver run found the confirm text naming the AI's guess, a clock that ignored opened doors, the 6-hour freezer rule skipped with a reading, lenient defaults for damaged saved data, a date field wiped by one Backspace, photo results lost when leaving the screen, and a countdown re-read every second.
  Build: `outageSpan()` and `fridgeSafeHours()` shared by rules, clock and form; `matchDoubt()`; stricter `load()`; `DateTimeInput`; service worker that saves a page's files before the page; `scripts/a11y-check.mjs`, `scripts/keyboard-check.mjs`, `scripts/voiceover/`.
  Verify (mechanical): `npm test` (63 tests), `npm run e2e` (3 tests), `node scripts/a11y-check.mjs` (no violations), `node scripts/keyboard-check.mjs` ("keyboard journey ok"), `node scripts/offline-check.mjs` on the live site.
  Commit: 6495862
