# Fridge Triage

After a power outage, photograph your fridge and freezer and get a keep-or-toss call for every item, straight from the FoodSafety.gov charts and your outage times, plus a dated record of what you threw out.

**Live:** https://fridge-triage.mikey9220.workers.dev

## Why

US electricity customers averaged 11 hours without power in 2024, nearly twice the decade before ([EIA](https://www.eia.gov/todayinenergy/detail.php?id=66744)). When the power comes back, the official answer to "is this still good?" is a two-part chart on FoodSafety.gov: a closed fridge keeps food safe for about 4 hours, a full freezer about 48 (24 if half full), and after that it depends on the food. Shredded cheese goes; a block of cheddar stays. Cut melon goes; a whole one stays. Most people never find the chart, go by smell (which USDA says never to do), or throw out everything.

## How it works

**The AI only looks; the chart decides.**

1. **Cold clock.** Tap "The power is out" and the app counts down the fridge's 4 hours and the freezer's 24 or 48. It is saved on the device, so closing the tab loses nothing.
2. **Photos.** When the power is back, add up to three photos. A vision model lists the food it can see and matches each item to a row of the FoodSafety.gov charts, with "cut" and "opened" when it can tell. It is never asked whether anything is safe. Photos are not stored.
3. **Verdicts from the chart.** Plain code reads the matched row, how long the power was out, how full the freezer was, whether the fridge door stayed closed, and any thermometer reading, then says **Toss**, **Check**, **Refreeze** or **Keep**, with the chart row and the condition that applied. Anything the model couldn't place goes to Check, never Keep.
4. **Fix in one tap.** Change an item's row, mark it cut or whole, opened or sealed, move it to the freezer, say it still has ice crystals, or remove it. The verdict updates immediately.
5. **Loss record.** A dated, printable list of everything tossed, with the outage times, for a SNAP replacement request or an insurance claim.

The clock, adding by hand, the verdicts and the record all work without the AI.

### The rules

`src/chart.ts` holds every row of both charts word for word (refrigerated: 54 rows; frozen: 20 rows; FoodSafety.gov, reviewed August 8, 2024). `src/rules.ts` applies them:

- Fridge at 40°F or below when the power came back → keep. Otherwise, out 4 hours or less with the door mostly closed (2 hours if it was opened a lot) → keep. Past that → the chart's "above 40°F for more than 2 hours" column.
- Opened mayonnaise, tartar sauce, horseradish → the chart's 50°F / 8-hour rule.
- The chart lists some foods only as cut or opened; the app's partner rows for the other state are marked "not a chart row" and are conservative (sealed items it can't vouch for go to Check).
- Freezer within its hold time → keep. Past it → ice crystals (or a freezer thermometer at 40°F or below) uses the chart's first column, otherwise the second; frozen vegetables use the chart's 6-hour rule.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # rules, clock, storage, recognizer answer checks (Vitest)
npm run e2e            # the whole journey in Chrome, recognizer stubbed (Playwright)
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

- React 19, Vite 8, TypeScript, Cloudflare Workers with static assets.
- A vision model behind one Worker endpoint (`worker/recognize.ts`), with a strict JSON schema and answer checking.
- Planned and built with the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics) for Build With AI: Basics: the scope, PRD, spec, build checklist and app map are in [`devpost/`](devpost/).

## Sources and credits

- Rules: [FoodSafety.gov, Food Safety During Power Outage](https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage) (US government work).
- Sample photo (`public/sample-fridge.jpg`): USDA FSIS photo by Lance Cheung, "Food Safety - Cut Waste in Refrigerators" (20200605-FSIS-LSC-0059), public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Food_Safety_-_Cut_Waste_in_Refrigerators_(20200605-FSIS-LSC-0059).jpg).
- SNAP replacement: [state SNAP offices](https://www.fns.usda.gov/snap/state-directory).

Fridge Triage is not affiliated with USDA or FoodSafety.gov and is not medical advice. Never taste food to decide. When in doubt, throw it out.

## License

MIT
