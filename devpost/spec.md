---
doc: spec
status: approved
---

# Fridge Triage — Technical Spec

## How This Works, In Plain Language
Fridge Triage is one web page with a small server behind it.

- **The page** (React, running in the phone's browser) does almost everything: it keeps the outage times and the cold clock, shrinks the photos, shows and edits the item list, works out every verdict, and draws the printable loss record. It saves its state in the browser's local storage, so closing the tab during an outage loses nothing.
- **The chart** is a file in the code: every row of the two FoodSafety.gov power-outage charts (refrigerated and frozen), word for word, with what the chart says to do. The verdict rules read only this file and the outage facts. This is the part that decides, and it never calls the AI.
- **The recognizer** is the only server piece: one endpoint on a Cloudflare Worker. The page sends it a photo; it asks a vision model to list the food it sees and pick, for each item, the chart row it belongs to. It returns that list and forgets the photo.

Why this shape: the decision has to be exact and explainable, so it lives in plain code over the official table; recognizing food in a messy photo is fuzzy, so that goes to the model, and the person can correct it. With no network, everything except the photo step still works.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. The person taps "The power is out" → the **Outage store** saves `{start, freezerFill}` to local storage → the **Cold clock** counts down from those times once a second.
2. They tap "The power is back" → the store saves `end` → the app opens Check my food.
3. They add a photo → **Photo intake** draws it on a canvas no larger than 1280 px and makes a JPEG → the **Recognizer client** posts it to `POST /api/recognize` → the **Recognizer endpoint** sends it with the chart's row list to the model and validates the JSON it gets back → the client adds the items to the store, tagged with the photo they came from.
4. The **Item list** shows them; every edit (row, cut/opened, fridge/freezer, ice crystals, remove, add) updates the store.
5. The **Verdict rules** run over every item with the outage facts each time the store changes → the **Verdict view** shows Toss / Check / Refreeze / Keep with the chart row and the condition that applied.
6. "Save loss record" → the **Loss record** page lists the tossed items with the outage times and prints with the browser's print dialog.

## Stack
- **TypeScript 7** for everything (https://www.typescriptlang.org/docs/) — one language for page, rules and Worker; the rules get type-checked row ids.
- **React 19.3** (https://react.dev) with **Vite 8** (https://vite.dev) — a fast dev server and a static build; the entrant's usual front-end stack.
- **Cloudflare Workers** with static assets and **@cloudflare/vite-plugin** (https://developers.cloudflare.com/workers/vite-plugin/) — the page and the one endpoint deploy together for free; `wrangler` 4 deploys (https://developers.cloudflare.com/workers/wrangler/).
- **Workers rate limiting binding** (https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) — caps recognizer calls per visitor so a public demo can't run up the model quota.
- **Vitest 5** (https://vitest.dev) for the rules and the Worker's response checking; **Playwright 1.63** (https://playwright.dev) for one end-to-end run of the core journey with the recognizer stubbed.
- No UI kit and no CSS framework: one hand-written stylesheet keeps the dark, large-type look exact and the bundle small.
- Unverified until slice 1: that the model relay accepts image input with a JSON-schema response format. A quick check on the Mac showed images are accepted; the schema format is checked in the first slice, with a plain "answer only JSON" fallback.

## Where It Runs and How Someone Tries It
- Needs Node 22+ and npm.
- `npm install`, then `npm run dev` and open http://localhost:5173 on a desktop or a phone on the same network.
- Photo recognition needs two values in `.dev.vars` (see `.dev.vars.example`): `RELAY_URL` and `RELAY_KEY` for an OpenAI-Responses-compatible endpoint. Without them the app runs in manual mode; everything else works.
- `npm test` runs the rules and Worker checks; `npm run e2e` runs the journey in Chrome.
- Deploy: `npm run deploy` (wrangler) to https://fridge-triage.mikey9220.workers.dev, with `RELAY_KEY` set once by `wrangler secret put RELAY_KEY`.
- The demo video is recorded on the deployed app in a phone-sized browser window.

## Look and Feel
From `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.
- Dark by default: background `#0e1013`, raised cards `#171a1f`, text `#eef0f3`, muted text `#a7adb7`. Light theme under `prefers-color-scheme: light` and always in print: white background, `#15171a` text.
- Verdict colours (as text plus a coloured tag, never colour alone): Toss `#ff6b6b`, Check `#ffbf47`, Refreeze `#6cb6ff`, Keep `#4cd38a`; on light, darker variants with 4.5:1 contrast.
- System sans-serif at 18 px with 1.45 line height; clock digits in `ui-monospace` with tabular numbers.
- Single column, at most 560 px wide, 16 px side padding; buttons at least 48 px tall; verdict sections as stacked lists, one line per item with the reason under it in muted text.
- Copy: short, plain sentences in second person ("Toss it"). No emoji, no illustrations.

## Components

### Chart data
`src/chart.ts`. Every row of both FoodSafety.gov charts (date last reviewed August 8, 2024) as `{id, chart: 'fridge' | 'freezer', group, label, words, verdict}`: the label is the chart's own text, `words` are everyday search terms, and `verdict` is what the chart's columns say (fridge: `discard`, `keep`, or `discard-50f-8h`; freezer: one value for "contains ice crystals" and one for "above 40°F for more than 2 hours", including `discard-after-6h`). Rows that the chart only lists as "opened" or "cut" have a partner for the other state, marked `onChart: false` with the reason the app uses for it. Also the fridge-to-freezer row pairs used when an item is moved.
Implements `prd.md > Verdict rules (the kernel)`.

### Verdict rules
`src/rules.ts`. `verdict(item, outage, now)` returns `{call: 'toss' | 'check' | 'refreeze' | 'keep', reason, row}` following `prd.md > Verdict rules (the kernel)` exactly: fridge thermometer, the 4-hour (door closed) or 2-hour (door opened) window, the chart column, the 8-hour mayonnaise rule, cut/opened partners, freezer hold time (48 h full, 24 h half or unknown), ice crystals or freezer thermometer, the 6-hour vegetable rule, and Check for anything without a row. Pure function, no I/O.
Implements `prd.md > Verdict rules (the kernel)`.

### Outage store
`src/store.ts`. The app state (outage and items) in one React reducer, saved to local storage under `fridge-triage:v1` on every change and read back on load; "Start over" clears it.
Implements `prd.md > Cold clock`, `prd.md > States and Boundaries`.

### Cold clock
`src/components/ColdClock.tsx`. Two countdowns from the outage start: fridge 4 h, freezer 48 h or 24 h; re-renders every second while the power is out, and shows the elapsed outage once it is back.
Implements `prd.md > Cold clock`.

### Outage details
`src/components/OutageForm.tsx`. Start and end times (today or yesterday, 5-minute steps), freezer fullness, door mostly closed, optional fridge and freezer thermometer readings in °F. Rejects an end before the start.
Implements `prd.md > The Core Journey` (steps 2–3).

### Photo intake
`src/photos.ts`. Reads a camera or gallery image, draws it to a canvas no larger than 1280 px on the long side, and returns a JPEG data URL (quality 0.8).
Implements `prd.md > Photo recognition`.

### Recognizer client
`src/recognize.ts`. Posts `{image}` to `/api/recognize` with a 45-second timeout and returns the items or a plain error message.
Implements `prd.md > Photo recognition`.

### Recognizer endpoint
`worker/index.ts` routes `POST /api/recognize` (everything else goes to the static assets). `worker/recognize.ts` checks the rate limit, builds the model request from the chart rows (ids and labels for both charts), calls the relay, and validates the answer: unknown row ids become `null`, places other than fridge/freezer become fridge, and at most 60 items are kept. Returns `{items}` or `{error}` with a status code.
Implements `prd.md > Photo recognition`.

### Item list
`src/components/ItemList.tsx` and `src/components/RowPicker.tsx`. Items grouped by place with remove, row picker (search over `label` and `words` in the place's chart), cut/opened toggles where the row has a partner, fridge/freezer switch, ice-crystal toggle for freezer items, "check the match" for low-confidence items, and "Add an item".
Implements `prd.md > Review and edit`.

### Verdict view
`src/components/Verdicts.tsx`. The summary bar and the four sections in Toss, Check, Refreeze, Keep order, each item with its reason and chart row; tick boxes on Toss and Check.
Implements `prd.md > The Core Journey` (step 6), `prd.md > Verdict rules (the kernel)`.

### Loss record
`src/components/LossRecord.tsx`. A print-styled page: date made, outage start, end and length, the tossed items with their place, the SNAP note with a link to https://www.fns.usda.gov/snap/state-directory, and the FoodSafety.gov source line.
Implements `prd.md > Loss record`.

### App shell
`src/App.tsx`, `src/main.tsx`, `src/styles.css`. Hash routes (`#/`, `#/outage`, `#/check`, `#/results`, `#/record`), the header with "Start over", and the one stylesheet.
Implements `prd.md > Screens and Layout`.

## Data Model
```ts
type Outage = {
  start: string | null;          // ISO time the power went out
  end: string | null;            // ISO time it came back; null while out
  freezerFill: 'full' | 'half' | 'unknown';
  doorClosed: boolean;           // fridge door stayed mostly closed (default true)
  fridgeTempF: number | null;    // thermometer when the power came back
  freezerTempF: number | null;
};
type Item = {
  id: string;
  name: string;                  // as seen or typed: "bag of shredded cheese"
  place: 'fridge' | 'freezer';
  row: string | null;            // chart row id
  cut: boolean | null;
  opened: boolean | null;
  ice: boolean;                  // freezer item still has ice crystals / feels fridge-cold
  sure: boolean;                 // false = "check the match"
  from: 'photo' | 'hand';
  cleared: boolean;              // ticked off while clearing the shelves
};
type State = { outage: Outage; items: Item[] };
```
All of it lives in local storage on the device and is reloaded on the next visit until "Start over". Photos exist only in memory until the recognizer answers.

## File Structure
```
fridge-triage/
├── src/
│   ├── main.tsx              # mounts the app
│   ├── App.tsx               # hash routes, header, start over
│   ├── chart.ts              # both FoodSafety.gov charts as data (the source of every verdict)
│   ├── rules.ts              # verdict(item, outage, now): the kernel
│   ├── store.ts              # reducer + local storage
│   ├── photos.ts             # resize to ≤1280 px JPEG
│   ├── recognize.ts          # POST /api/recognize client
│   ├── time.ts               # durations and clock formatting
│   ├── styles.css            # the one stylesheet (dark, light, print)
│   └── components/
│       ├── ColdClock.tsx
│       ├── OutageForm.tsx
│       ├── PhotoSlots.tsx
│       ├── ItemList.tsx
│       ├── RowPicker.tsx
│       ├── Verdicts.tsx
│       └── LossRecord.tsx
├── worker/
│   ├── index.ts              # routes /api/recognize, serves assets otherwise
│   └── recognize.ts          # rate limit, model request, answer validation
├── tests/
│   ├── rules.test.ts         # every row, every exposure case
│   ├── recognize.test.ts     # answer validation
│   └── journey.spec.ts       # Playwright: outage → photo (stubbed) → verdicts → record
├── public/
│   └── sample-fridge.jpg     # demo photo (license noted in README)
├── devpost/                  # planning docs (learner-profile.md is git-ignored)
├── index.html
├── wrangler.jsonc
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .dev.vars.example
├── LICENSE                   # MIT
└── README.md
```

## External Services and Dependencies
- **Model relay** (OpenAI Responses API format, the entrant's own relay to a ChatGPT-plan model).
  - `POST {RELAY_URL}/responses` with headers `content-type: application/json`, `x-relay-key: {RELAY_KEY}`, `x-relay-collect: 1`, and a user agent.
  - Body: `{model: "gpt-5.5", reasoning: {effort: "low"}, store: false, stream: true, instructions, input: [{role: "user", content: [{type: "input_text", text}, {type: "input_image", image_url: "data:image/jpeg;base64,..."}]}], text: {format: {type: "json_schema", name: "fridge_items", schema, strict: true}}}`.
  - Response: the collected Responses object; the app reads the `output_text` parts and parses JSON `{items: [{name, place, row, cut, opened, sure}]}`.
  - Docs: https://platform.openai.com/docs/api-reference/responses. Cost: none to the entrant beyond the existing plan; rate limited below.
- **Cloudflare Workers** free plan: the Worker, static assets, and a rate limit of 6 recognizer calls per minute per IP address. Docs linked in Stack.
- **FoodSafety.gov charts**: public US government content, copied into `src/chart.ts` with the source URL and review date.

## Important Failure Modes
- **The recognizer is slow, down, rate-limited or returns bad JSON** → the photo slot says "Couldn't read this photo" with the reason, items already found stay, and "Add items by hand" is right there.
- **The model picks the wrong row or misses a state** (shredded vs block cheese, cut vs whole melon) → low-confidence items are flagged "check the match", every item shows the row it was matched to, and changing it is one tap; items with no row are Check, never Keep.
- **Wrong or missing outage times** → the form rejects an end before the start; with no start time, the results page asks for it before showing verdicts.

## What Was Simplified and Why
- **A fixed 4-hour (fridge) and 24/48-hour (freezer) model** instead of estimating temperature over time — it is exactly what USDA publishes; the fuller version would need the appliance's insulation, room temperature and door openings.
- **One fridge and one freezer** instead of several appliances — enough to prove the loop; the fuller version adds an appliance id to items and outages.
- **Browser print for the loss record** instead of generating a PDF — every phone and desktop can already save a page as PDF.
- **Hash routes in one React app** instead of a router library — five screens don't need one.

## Decisions and Open Issues
- **Rules in code, recognition by the model** — chosen by the agent under the entrant's delegation (`learner-profile.md`), because the stakes are food safety and the official chart fits in a file; tradeoff: the chart has to be kept in step with FoodSafety.gov by hand (review date shown in the app).
- **Conservative defaults** — unknown row, unknown freezer fill, or a door that was opened all move items toward Check or Toss.
- **The entrant's own relay** for the model, rate limited — no new paid service; tradeoff: the public demo depends on that relay being up, so manual mode must stay complete.
- **One genuine uncertainty**: whether a vision model reliably tells shredded from block cheese and cut from whole fruit in an ordinary fridge photo. Checked in the first slice with the sample photo; if it can't, the "check the match" flag and one-tap row change carry the demo.
  Result (slice 3): on the sample USDA fridge photo the model listed "bag of shredded cheese" and "block of cheese" as separate items with the right rows, and "container of cut pineapple" as cut fruit, in about 17 seconds for 26 items.
- Carried from `prd.md > Open Questions`: none blocking.
