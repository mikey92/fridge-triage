---
doc: scope
status: approved
---

# Fridge Triage

After a power outage, photograph your fridge and freezer and get a keep-or-toss call for every item, straight from the FoodSafety.gov charts and your outage times, plus a dated record of what you threw out.

## The Unique Kernel
The AI only looks; the chart decides. A vision model lists what is in the photos and matches each item to a row of the official FoodSafety.gov power-outage charts (refrigerated and frozen). The keep-or-toss call itself comes from a fixed rule table: that row, how long the power was out, how full the freezer was, and anything the person measured (a fridge thermometer, ice crystals in a freezer bag). Every verdict shows the chart row it came from. Whatever the model cannot place goes to "check it yourself", never to "keep".

## Who It's For
Someone whose power has just come back after a storm or a planned shutoff (a California Public Safety Power Shutoff, a hurricane, a winter storm), standing in front of a fridge that is no longer cold. US electricity customers averaged 11 hours without power in 2024, nearly twice the average of the decade before (EIA).
What they do today: search "how long is food good in the fridge without power", find a two-page chart, and go item by item with the door open; or throw everything out; or keep the wrong things. Households on SNAP can ask for replacement benefits for food lost to an outage of 4 hours or more, but must report it within 10 days and need to say what was lost.

## The Core Loop
1. The power goes out: open the app and tap "Power's out". The cold clock starts: the fridge keeps food safe for about 4 hours with the door closed, a full freezer about 48 hours (24 if half full).
2. The power comes back (or the clock runs out): tap "Check my food" and take one to three photos (fridge shelves, door, freezer).
3. See the list the AI found, fix what it got wrong (remove, add, mark "cut" or "opened"), and get Toss, Keep, Refreeze or Check for each item, with its chart row.
4. Tick items off while clearing the shelves, then save the dated loss record.
The cold clock is the reason to open it again at the next outage, before the fridge is warm.

## Inspiration & Identity
- A field triage tag: a few colours, one decision per item, no paragraphs.
- Reading by flashlight: dark by default (it also saves an OLED phone's battery when the power is out), large type, high contrast, big tap targets.
- Source: FoodSafety.gov "Food Safety During Power Outage" (https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage), which carries both charts and the USDA 4-hour and 24/48-hour guidance.
- Calm and plain. No cartoon food, no sparkle icons, no chat bubbles.

## Why This Matters to the Learner
The entrant wanted a project that is new for this contest and solves a real problem for a specific person. Outages are getting longer, the official guidance already exists but only as a printed chart, and getting it wrong means either food poisoning or throwing out a week of groceries.

## What "Working" Looks Like
Open the app and say the power was out from 2:00 pm to 9:30 pm. Add a photo of a fridge. About twenty seconds later the list appears (milk, eggs, shredded cheese, a block of cheddar, deli turkey, butter, ketchup, mayonnaise, leftover rice, whole apples, cut melon), and so do the verdicts: toss the milk, eggs, shredded cheese, turkey, rice and melon; keep the cheddar, butter, ketchup and apples; check the mayonnaise (toss it if it sat above 50°F for more than 8 hours). Each line shows its chart row. Save the loss record and get a dated list ready to print.
The "oh, that's cool" beat: the block of cheddar and the bag of shredded cheese side by side, one kept and one tossed, each with the chart line that says why.

## The POC Boundary
- Outage start and end times, freezer fullness and an optional thermometer reading, with a live cold clock while the power is out.
- One to three photos → an AI item list matched to chart rows, with "cut" and "opened" flags.
- Editing the list: remove, add from the chart, toggle cut/opened, move between fridge and freezer.
- The rule table from both FoodSafety.gov charts → Toss / Keep / Refreeze / Check, with the chart row.
- A dated loss record (printable page) of what was tossed.
- Runs in a phone browser; the clock, the manual list and the rules work without the AI.

## Later
- An estimated replacement value per item for SNAP or insurance forms.
- More than one appliance (a garage freezer, a mini fridge).
- Notifications when the cold clock crosses 4, 24 or 48 hours.
- Spanish and other languages.

## Explicitly Cut
- Accounts and stored photos: nothing needs to outlive this outage on this device, and fridge photos are private.
- Letting the AI judge safety: the model never says "safe"; it only recognizes food.
- Expiry dates and "it smells fine" advice: the charts don't cover them, and USDA says never to taste food to judge its safety.
- Restaurant and grocery rules: a different code with different stakes.
