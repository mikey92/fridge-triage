# How well the photo reading works

Measured on October 4, 2026, on 13 photos of real home refrigerators, each item labeled by hand. The question that matters for food safety: **how often would the app tell someone to keep food the FoodSafety.gov chart says to throw out?**

| | First version (commit `b8fff1e`, Oct 3) | Now |
|---|---|---|
| Toss-worthy food shown as **Keep** (tuning photos) | **10 of 59** | **0 of 66** |
| Toss-worthy food shown as **Keep** (held-out photos) | **4 of 17** | **0 of 18** |
| Food the AI matched wrongly to a Keep row, which the person sees as "Confirm" and has to catch | (no confirm step) | 4 of 66 · 0 of 18 |
| Items found (tuning · held-out) | 88% · 92% | 86% · 94% |
| Right chart row (tuning · held-out) | 80% · 81% | 79% · 88% |
| Seconds per photo (tuning · held-out) | 6.8 · 3.8 | 8.4 · 4.9 |

## Method

- **Photos.** 13 public-domain USDA FSIS photos by Lance Cheung, *Food Safety – Cut Waste in Refrigerators* (June 2020, via Wikimedia Commons), in `eval/photos/`. Eight were used while changing the prompt (**tuning**); five were set aside and read only once the prompt was final (**held-out**).
- **Labels** (`labels.json`). Every food in each photo, written down by looking at the full-size photo, with the chart rows that fit it. Items whose contents can't be seen are marked `unclear`; items whose right row can't be told from the photo (a green juice that may be fruit or vegetable) are marked `ambiguous` and left out of the safety count. One held-out label was corrected before scoring: a carton first marked unclear turned out to have a readable nutrition label (1 Tbsp, 50 calories, 5 g fat), so it is labeled cream.
- **Runs** (`runs/`). `run.ts` sends each photo to the same recognizer the app uses (`worker/recognize.ts`), twice, because answers vary from run to run. gpt-5.5 with low reasoning effort, as deployed. Every eval photo shows the fridge, and the person says so, as they would in the app.
- **Judging** (`judged.json`). Each answer is matched by hand to the labeled item it refers to, by looking at the photo: "container of grapes" in a photo of a container of peas counts as the peas.
- **Scoring** (`score.ts`). Each answer goes through the app's own rules (`src/rules.ts`) for a 7½-hour outage with the doors mostly closed and the freezer half full: past the fridge's 4 hours, within the freezer's 24. The right call for an item is its labeled row through the same rules. *Toss-worthy* means the right call is Toss.

```bash
npx tsx eval/score.ts eval/runs/v2-gpt-5.5-low eval/runs/v2-gpt-6.1-sol-low            # this version, tuning photos
SET=held-out npx tsx eval/score.ts eval/runs/v2-gpt-5.5-low eval/runs/v2-gpt-6.1-sol-low
sh eval/first-version.sh        # the first version: its own prompt and rules, from commit b8fff1e
TAG=v2-gpt-5.5-low npm run eval:run   # read the photos again (needs RELAY_URL and RELAY_KEY in .dev.vars)
```

## What went wrong in the first version

| Toss-worthy food | The AI said | The app said |
|---|---|---|
| Raw whole chicken and raw bacon in the meat drawer (two photos, both runs: 8 answers) | "whole raw turkey", "bag of frozen raw meat" — in the **freezer** | Keep (a half-full freezer holds 24 hours) |
| Cheese party tray with Monterey Jack, a soft cheese the chart discards (2) | "processed cheese slices", "hard cheese" | Keep |
| Bulgarian yogurt bottle | "jar of Miracle Whip" | Keep (mayonnaise allows 8 hours) |
| Cut lemon in foil | "slice of cheese" | Keep |
| Container of cooked meat leftovers | "covered container with pie slice" | Keep |
| Glass bottle of milk | "jar of pickles or relish" | Keep |

The model had marked six of the ten tuning-photo answers unsure, and the app kept them anyway.

## What changed

1. **The person says which appliance each photo shows.** A meat drawer is part of the fridge; the model was guessing. This alone removes 8 of the 14 unsafe answers.
2. **A rewritten prompt.** Read labels (a safe-handling label or a whole-bird shape means raw meat or poultry); call anything foil-wrapped or opaque "contents unclear"; put a mixed package under its most perishable food; say *sure* only when the item is plainly visible.
3. **The AI's match never keeps food on its own.** Every item from a photo that the chart would keep or refreeze is shown as **Confirm** — "Photos can fool the AI. It matched this to “Fresh fruits, uncut”. If that's right, the chart says keep." — until the person taps *Yes, that's right* or fixes the match. It names the chart row the AI matched, with its cut or opened state, so a "container of cut pineapple" matched to "Fresh fruits, uncut" reads as the mistake it is. Cheeses and butter get a sharper warning, because the chart keeps some cheeses and discards others that look the same.

The verdicts still come only from the chart rows and the outage times.

## What the person still has to catch

With the final prompt, the AI matched 4 toss-worthy tuning-photo answers to a Keep row (none on the held-out photos). The app shows each as Confirm with the AI's own name for it:

| Toss-worthy food | Shown as Confirm, named | AI said sure? |
|---|---|---|
| Container of green peas | "container of green olives" | yes |
| Container of green peas | "container of grapes" | yes |
| Glass bottle of milk | "jar of olives" | no |
| Cheese party tray with Monterey Jack | "party tray of sliced cheese" (hard cheese) | no (look-alike) |

Two answers also matched a tub of hummus, which isn't on the chart, to the condiments row ("jar of salsa"); they too wait for a Yes. The peas show why the confirm step exists: the model was sure both times.

## What it costs

Every keep-worthy item from a photo needs one tap: 38 in 16 tuning reads and 14 in 10 held-out reads, about 2 per photo. None of them were tossed by mistake.

## Model choice

Both models ran the final prompt and rules.

| | gpt-5.5 (deployed) | gpt-6.1-sol |
|---|---|---|
| Items found (tuning · held-out) | 86% · 94% | 99% · 97% |
| Right chart row | 79% · 88% | 54% · 73% |
| Keep-worthy items left at Check (no row) | 0 of 38 · 0 of 14 | 14 of 46 · 1 of 15 |
| Toss-worthy food matched to a Keep row | 4 · 0 | 2 · 0 |
| Seconds per photo | 8.4 · 4.9 | 17.8 · 10.3 |

gpt-6.1-sol lists nearly everything but calls most of it "contents unclear", so people would have to place far more items by hand, and it takes twice as long. It also read the raw chicken's yellow package as "yellow bell pepper", once sure. gpt-5.5 stays.

## Limits

- 13 photos from one photo series, all of fridges in good light. No freezer photos, no dim or cluttered phone shots.
- One person (the developer) labeled, judged and changed the prompt. The held-out photos guard against tuning to the test set, but not against the labeler's blind spots.
- Two runs per photo; the model's answers vary between runs, so small differences (86% vs 88% found) are noise.
- The person is the last check. Someone who taps Yes without looking can still keep the peas. The app makes that a deliberate tap on a named item, not a default.
