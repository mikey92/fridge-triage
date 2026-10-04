# Fridge Triage

After a power outage, photograph your fridge and freezer and get a keep-or-toss call for every item, straight from the FoodSafety.gov charts and your outage times, plus a dated record of what you threw out.

**Live:** https://fridge-triage.mikey9220.workers.dev · **Demo video (2:45):** https://youtu.be/QPrkvtHQyAA

## Why

US electricity customers averaged 11 hours without power in 2024, nearly twice the decade before ([EIA](https://www.eia.gov/todayinenergy/detail.php?id=66744)). When the power comes back, the official answer to "is this still good?" is a two-part chart on FoodSafety.gov: a closed fridge keeps food safe for about 4 hours, a full freezer about 48 (24 if half full), and after that it depends on the food. Shredded cheese goes; a block of cheddar stays. Cut melon goes; a whole one stays. Most people never find the chart, go by smell (which USDA says never to do), or throw out everything.

## How it works

**The AI only looks; the chart decides; you confirm.**

1. **Cold clock.** Tap "The power is out" and the app counts down the fridge's 4 hours and the freezer's 48 (full) or 24 (half full). It is saved on the device, so closing the tab loses nothing.
2. **Photos.** When the power is back, add up to three photos and say whether each shows the fridge or the freezer. A vision model lists the food it can see and matches each item to a row of the FoodSafety.gov charts, with "cut" and "opened" when it can tell. It is never asked whether anything is safe. Photos are not stored.
3. **Verdicts from the chart.** Plain code reads the matched row, how long the power was out, how full the freezer was, whether the doors stayed closed, and any thermometer reading, then says **Toss**, **Check**, **Refreeze** or **Keep**, with the chart row and the condition that applied.
4. **A photo never keeps food on its own.** Anything the AI matched to a row the chart would keep or refreeze shows as **Confirm**, naming the row it matched ("It matched this to “Fresh fruits, uncut”"), until you tap *Yes, that's right* or fix it. Photos can make peas look like grapes, and the chart keeps some cheeses and throws out others that look the same. Anything it couldn't place goes to Check.
5. **Fix in one tap.** Change an item's row, mark it cut or whole, opened or sealed, move it to the freezer, say it still has ice crystals, or remove it. The verdict updates immediately.
6. **Loss record.** A dated, printable list of everything marked Toss, plus anything under Check you ticked as thrown out, with the outage times, for a SNAP replacement request or an insurance claim.

The clock, adding by hand, the verdicts and the record all work without the AI, and without a connection: after the first visit the app is kept on the device (add it to the home screen), so it opens during an outage with no Wi-Fi. Only reading photos needs the network. `scripts/offline-check.mjs` checks this on the live site: it loads the app, cuts the network, reloads, and adds food by hand.

### The rules

`src/chart.ts` holds every row of both charts word for word (refrigerated: 54 rows; frozen: 20 rows; FoodSafety.gov, reviewed August 8, 2024). The chart lists some foods only as opened; the app adds 9 partner rows for their sealed versions, marked "not a chart row". Six say Check, with what to look for on the label (keep it only if it was sold unrefrigerated). Three keep, because the chart already keeps the opened version: fruit juice, canned fruit and vinegar-based dressing. `src/rules.ts` applies them:

- **Fridge.** Out 4 hours or less with the doors mostly closed → keep; 2 hours if they were opened a lot or a fridge thermometer read 40°F or above. Past that → the chart's "Exposed to temperatures of 40°F (4°C) or above for more than 2 hours" column. A thermometer reading only ever makes the call stricter: FoodSafety.gov says to discard refrigerated perishables after 4 hours without power.
- **Opened mayonnaise, tartar sauce, horseradish** → the chart's "discard if above 50°F for over 8 hours": keep within 8 hours or with a reading of 50°F or below; toss past 8 hours with a reading above 50°F; check past 8 hours with no reading.
- **Freezer.** A reading of 0°F or below → keep. Ice crystals, or a reading of 40°F or below → the chart's "Contains ice crystals" column (refreeze, except ice cream and frozen yogurt). With no reading and the doors closed, a full freezer counts 48 hours and a half-full one 24. Less than half full, not sure, or the doors opened a lot: no hold time is counted, so each item says to check it for ice crystals. Past the hold with no ice crystals marked, or with a reading above 40°F → the chart's warm column. Frozen vegetables and vegetable juice use its 6-hour rule, counted from the end of the hold time (48 hours when none can be counted, the longest any freezer holds), with or without a reading.
- **Times that don't add up** (power back before it went out, or a time in the future) → check, never a verdict. Times are compared to the minute, as the form shows them.
- **The cold clock** counts down on the same terms: 2 hours for the fridge if the doors were opened a lot or it read 40°F or above, and no freezer hold time with the doors opened.
- **Saved data** is checked when the app opens. Anything missing or malformed falls back to the stricter choice: no reading, doors opened, and an AI match that still needs a Yes.

### How well the photo reading works

Measured on 13 public-domain USDA photos of real fridges, every item labeled by hand, two runs per photo, for a 7½-hour outage ([`eval/EVAL.md`](eval/EVAL.md)):

| | First version (Oct 3) | Now |
|---|---|---|
| Toss-worthy food shown as Keep | 14 of 76 | 0 of 84 |
| …of which on the 5 held-out photos | 4 of 17 | 0 of 18 |
| Items found · right chart row (held-out) | 92% · 81% | 94% · 88% |

The first version read raw chicken in the meat drawer as freezer food and trusted guesses it marked unsure. Now the person says which appliance each photo shows, and every Keep from a photo waits for their Yes. The AI still matched 4 toss-worthy answers to a Keep row (peas as "grapes"); they show as Confirm, named, for the person to catch.

## Accessibility

Someone sorting a fridge after an outage may be doing it by flashlight, on a phone, or with a screen reader. Checked with:

- **axe-core** on 10 screens in dark and light mode (`node scripts/a11y-check.mjs`): no violations. **Lighthouse** on the live site: 100 for accessibility, performance, best practices and SEO.
- **Keyboard only** (`node scripts/keyboard-check.mjs`): the whole journey with Tab, Enter and Space, checking where focus lands after every screen change and that every control shows a focus ring.
- **VoiceOver** on macOS with Chrome, driven by its own keys, with what it said read back from its caption panel (`scripts/voiceover/`).

What the screen-reader test found, all fixed: the cold clock was re-read every second (it now speaks to the minute); focus fell to the top of the page when the sample-photo button disappeared, and the photo's result was never announced (focus stays on the photo button, and "Found 6 items" is announced); each Toss and Check item's name was read twice (once now); starting the clock or starting over removed the button that had focus, leaving the reader at the top of the page (focus now moves to the new heading). The Yes button names the match itself ("Yes, “container of grapes” is “Fresh fruits, uncut”"), so a wrong match is audible, and form errors are announced as they appear.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # rules, clock, storage, recognizer answer checks (Vitest, 63 tests)
npm run e2e            # the whole journey in Chrome, recognizer stubbed (Playwright, 3 tests)
npx tsx eval/score.ts eval/runs/v2-gpt-5.5-low    # score saved recognizer runs against the hand labels
```

Photo recognition needs an OpenAI Responses-API-compatible endpoint. Copy `.dev.vars.example` to `.dev.vars` and fill in `RELAY_URL` and `RELAY_KEY`; without them the app runs in manual mode. The model is set by `MODEL` in `wrangler.jsonc`.

Deploy to Cloudflare Workers (free plan):

```bash
npx wrangler secret put RELAY_URL
npx wrangler secret put RELAY_KEY
npm run deploy
```

Recognizer calls are rate limited to 6 per minute per visitor.

## Built with

- React 19, Vite 8, TypeScript, Cloudflare Workers with static assets, a service worker for offline use.
- A vision model behind one Worker endpoint (`worker/recognize.ts`), with a strict JSON schema and answer checking.
- Planned and built with the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics) for Build With AI: Basics: the scope, PRD, spec, build checklist and app map are in [`devpost/`](devpost/).

## Sources and credits

- Rules: [FoodSafety.gov, Food Safety During Power Outage](https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage) (US government work).
- Photos (`public/sample-fridge.jpg`, `eval/photos/`): USDA FSIS photos by Lance Cheung, "Food Safety - Cut Waste in Refrigerators" (June 2020), public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Food_Safety_-_Cut_Waste_in_Refrigerators_(20200605-FSIS-LSC-0059).jpg).
- SNAP replacement: [state SNAP offices](https://www.fns.usda.gov/snap/state-directory).

Fridge Triage is not affiliated with USDA or FoodSafety.gov and is not medical advice. Never taste food to decide. When in doubt, throw it out.

## License

MIT
