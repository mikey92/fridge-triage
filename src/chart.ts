// Both FoodSafety.gov power-outage charts, word for word:
// https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage (date last reviewed August 8, 2024).
// Every verdict in the app comes from these rows (see rules.ts). The AI only picks which row an item belongs to.

export const CHART_URL = "https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage";
export const CHART_REVIEWED = "August 8, 2024";

export type Place = "fridge" | "freezer";

// Refrigerated chart, column "Exposed to temperatures of 40°F (4°C) or above for more than 2 hours".
// "sealed" marks the app's own partner rows for sealed versions of items the chart lists only as opened: keep them
// only if they are shelf-stable.
export type FridgeRule = "discard" | "keep" | "discard-above-50f-8h" | "sealed";

// Frozen chart, two columns: "Contains ice crystals and feels cold as if refrigerated" and
// "Exposed to temperatures of 40°F (4°C) or above for more than 2 hours".
export type FreezerRule = "refreeze" | "discard" | "discard-after-6h";

type Common = {
  id: string;
  group: string;
  label: string; // the chart's own words (for the app's partner rows, onChart: false, the app's own)
  words: string[]; // everyday words for search and for the recognizer
  onChart: boolean; // false for the app's sealed partner rows
  cut?: boolean; // the state this row stands for, when the chart splits by it
  opened?: boolean;
  twin?: string; // the row for the other cut/opened state
  move?: string; // the matching row in the other appliance
  lookAlike?: boolean; // a Keep row a photo can't tell from Toss rows that look the same (cheeses, butter): the person confirms an AI match
};

export type FridgeRow = Common & { place: "fridge"; rule: FridgeRule; note?: string };
export type FreezerRow = Common & { place: "freezer"; ice: FreezerRule; warm: FreezerRule; iceNote?: string; warmNote?: string };
export type Row = FridgeRow | FreezerRow;

const fridge = (id: string, group: string, label: string, rule: FridgeRule, words: string[], extra: Partial<FridgeRow> = {}): FridgeRow =>
  ({ id, place: "fridge", group, label, rule, words, onChart: true, ...extra });

const freezer = (id: string, group: string, label: string, ice: FreezerRule, warm: FreezerRule, words: string[],
  extra: Partial<FreezerRow> = {}): FreezerRow => ({ id, place: "freezer", group, label, ice, warm, words, onChart: true, ...extra });

export const FRIDGE_ROWS: FridgeRow[] = [
  // Meat, poultry, seafood
  fridge("r-meat", "Meat, poultry, seafood", "Raw or leftover cooked meat, poultry, fish, or seafood; soy meat substitutes", "discard",
    ["chicken", "beef", "pork", "steak", "ground beef", "fish", "salmon", "shrimp", "seafood", "turkey", "leftover meat", "tofu meat", "veggie burger", "meat substitute"],
    { move: "f-meat" }),
  fridge("r-thawing-meat", "Meat, poultry, seafood", "Thawing meat or poultry", "discard", ["thawing meat", "defrosting chicken", "thawing turkey"],
    { move: "f-meat" }),
  fridge("r-meat-salad", "Meat, poultry, seafood", "Salads: Meat, tuna, shrimp, chicken, or egg salad", "discard",
    ["tuna salad", "chicken salad", "egg salad", "shrimp salad", "ham salad"]),
  fridge("r-gravy", "Meat, poultry, seafood", "Gravy, stuffing, broth", "discard", ["gravy", "stuffing", "broth", "stock", "bone broth"],
    { move: "f-stews" }),
  fridge("r-lunchmeat", "Meat, poultry, seafood", "Lunchmeats, hot dogs, bacon, sausage, dried beef", "discard",
    ["deli meat", "lunch meat", "deli turkey", "ham slices", "salami", "pepperoni", "hot dogs", "bacon", "sausage", "bologna", "dried beef"],
    { move: "f-meat" }),
  fridge("r-pizza", "Meat, poultry, seafood", "Pizza with any topping", "discard", ["pizza", "leftover pizza", "pizza slices"],
    { move: "f-meal" }),
  fridge("r-canned-ham", "Meat, poultry, seafood", "Canned hams labeled \"Keep Refrigerated\"", "discard", ["canned ham", "keep refrigerated ham"]),
  fridge("r-canned-meat", "Meat, poultry, seafood", "Canned meats and fish, opened", "discard",
    ["canned tuna", "canned chicken", "sardines", "canned salmon", "spam", "opened tuna", "opened canned chicken", "opened sardines", "opened canned salmon", "opened spam"], { opened: true, twin: "r-canned-meat-sealed" }),
  fridge("r-canned-meat-sealed", "Meat, poultry, seafood", "Canned meats and fish, sealed", "sealed",
    ["sealed canned tuna", "unopened canned meat", "unopened can of fish"], { opened: false, twin: "r-canned-meat", onChart: false }),
  fridge("r-casserole", "Meat, poultry, seafood", "Casseroles, soups, stews", "discard",
    ["casserole", "soup", "stew", "chili", "lasagna", "curry", "leftover soup"], { move: "f-stews" }),

  // Cheese
  fridge("r-soft-cheese", "Cheese", "Soft cheeses: blue/bleu, Roquefort, Brie, Camembert, cottage, cream, Edam, Monterey Jack, ricotta, mozzarella, Muenster, Neufchatel, queso blanco, queso fresco", "discard",
    ["brie", "camembert", "blue cheese", "roquefort", "cottage cheese", "cream cheese", "edam", "monterey jack", "ricotta", "mozzarella", "muenster", "neufchatel", "queso blanco", "queso fresco", "feta", "goat cheese", "string cheese"],
    { move: "f-soft-cheese" }),
  fridge("r-hard-cheese", "Cheese", "Hard cheeses: Cheddar, Colby, Swiss, Parmesan, provolone, Romano", "keep",
    ["cheddar", "colby", "swiss cheese", "parmesan wedge", "provolone", "romano", "gruyere"],
    { move: "f-hard-cheese", lookAlike: true }),
  fridge("r-processed-cheese", "Cheese", "Processed cheeses", "keep", ["american cheese", "cheese singles", "velveeta", "processed cheese", "cheese spread"],
    { move: "f-soft-cheese", lookAlike: true }),
  fridge("r-shredded-cheese", "Cheese", "Shredded cheeses", "discard", ["shredded cheese", "bag of shredded cheese", "shredded mozzarella", "shredded cheddar"],
    { move: "f-shredded-cheese" }),
  fridge("r-lowfat-cheese", "Cheese", "Low-fat cheeses", "discard", ["low-fat cheese", "reduced fat cheese", "part-skim cheese"],
    { move: "f-soft-cheese" }),
  fridge("r-grated-cheese", "Cheese", "Grated Parmesan, Romano, or combination (in can or jar)", "keep",
    ["grated parmesan", "parmesan in a can", "grated romano", "shaker parmesan"]),

  // Dairy
  fridge("r-milk", "Dairy", "Milk, cream, sour cream, buttermilk, evaporated milk, yogurt, eggnog, soy milk", "discard",
    ["milk", "cream", "half and half", "whipping cream", "sour cream", "buttermilk", "evaporated milk", "yogurt", "greek yogurt", "eggnog", "soy milk", "almond milk", "oat milk", "creamer"],
    { move: "f-milk" }),
  fridge("r-butter", "Dairy", "Butter, margarine", "keep", ["butter", "margarine", "stick of butter"], { lookAlike: true }),
  fridge("r-formula", "Dairy", "Baby formula, opened", "discard", ["baby formula", "ready-to-feed formula", "formula bottle", "opened baby formula", "opened formula", "mixed formula"],
    { opened: true, twin: "r-formula-sealed" }),
  fridge("r-formula-sealed", "Dairy", "Baby formula, sealed", "sealed", ["sealed baby formula", "unopened formula"],
    { opened: false, twin: "r-formula", onChart: false }),

  // Eggs
  fridge("r-eggs", "Eggs", "Fresh shell eggs, eggs hard-cooked in shell, egg dishes, egg products", "discard",
    ["eggs", "carton of eggs", "hard boiled eggs", "egg dish", "liquid eggs", "egg whites"], { move: "f-eggs" }),
  fridge("r-custard", "Eggs", "Custards and puddings, quiche", "discard", ["custard", "pudding", "quiche", "flan"]),

  // Fruits
  fridge("r-fruit-cut", "Fruits", "Fresh fruits, cut", "discard",
    ["cut fruit", "cut melon", "sliced fruit", "fruit salad", "cut watermelon", "cut pineapple", "sliced apples"],
    { cut: true, twin: "r-fruit-whole", move: "f-fruit" }),
  fridge("r-fruit-whole", "Fruits", "Fresh fruits, uncut", "keep",
    ["apples", "oranges", "lemons", "limes", "grapes", "berries", "strawberries", "blueberries", "pears", "plums", "peaches", "whole melon", "kiwi"],
    { cut: false, twin: "r-fruit-cut", move: "f-fruit" }),
  fridge("r-juice", "Fruits", "Fruit juices, opened", "keep", ["orange juice", "apple juice", "fruit juice", "lemonade"],
    { opened: true, twin: "r-juice-sealed", move: "f-fruit-juice" }),
  fridge("r-juice-sealed", "Fruits", "Fruit juices, sealed", "keep", ["sealed juice", "unopened juice"],
    { opened: false, twin: "r-juice", onChart: false, move: "f-fruit-juice",
      note: "Not a separate chart row: the chart keeps opened fruit juice, so a sealed one keeps too." }),
  fridge("r-canned-fruit", "Fruits", "Canned fruits, opened", "keep", ["opened canned fruit", "canned peaches", "fruit cup", "applesauce"],
    { opened: true, twin: "r-canned-fruit-sealed" }),
  fridge("r-canned-fruit-sealed", "Fruits", "Canned fruits, sealed", "keep", ["sealed canned fruit"],
    { opened: false, twin: "r-canned-fruit", onChart: false,
      note: "Not a separate chart row: the chart keeps opened canned fruit, so a sealed can keeps too." }),
  fridge("r-dried-fruit", "Fruits", "Dried fruits, raisins, candied fruits, dates", "keep", ["dried fruit", "raisins", "dates", "prunes", "candied fruit"]),
  fridge("r-coconut", "Fruits", "Sliced or shredded coconut", "discard", ["shredded coconut", "sliced coconut", "fresh coconut"]),

  // Sauces, spreads, jams
  fridge("r-mayo", "Sauces, spreads, jams", "Opened mayonnaise, tartar sauce, horseradish", "discard-above-50f-8h",
    ["mayonnaise", "mayo", "tartar sauce", "horseradish", "aioli"], { opened: true, twin: "r-mayo-sealed" }),
  fridge("r-mayo-sealed", "Sauces, spreads, jams", "Mayonnaise, tartar sauce, horseradish, sealed", "sealed",
    ["sealed mayonnaise", "unopened mayo"], { opened: false, twin: "r-mayo", onChart: false }),
  fridge("r-peanut-butter", "Sauces, spreads, jams", "Peanut butter", "keep", ["peanut butter", "almond butter", "nut butter"]),
  fridge("r-condiments", "Sauces, spreads, jams", "Jelly, relish, taco sauce, mustard, catsup, olives, pickles", "keep",
    ["jelly", "jam", "relish", "taco sauce", "mustard", "ketchup", "catsup", "olives", "pickles"]),
  fridge("r-sauces", "Sauces, spreads, jams", "Worcestershire, soy, barbecue, hoisin sauces", "keep",
    ["worcestershire", "soy sauce", "barbecue sauce", "bbq sauce", "hoisin"]),
  fridge("r-fish-sauce", "Sauces, spreads, jams", "Fish sauces, oyster sauce", "discard", ["fish sauce", "oyster sauce"]),
  fridge("r-vinegar-dressing", "Sauces, spreads, jams", "Opened vinegar-based dressings", "keep",
    ["vinaigrette", "italian dressing", "balsamic dressing", "vinegar dressing"], { opened: true, twin: "r-vinegar-dressing-sealed" }),
  fridge("r-vinegar-dressing-sealed", "Sauces, spreads, jams", "Vinegar-based dressings, sealed", "keep", ["sealed vinaigrette"],
    { opened: false, twin: "r-vinegar-dressing", onChart: false,
      note: "Not a separate chart row: the chart keeps opened vinegar-based dressing, so a sealed bottle keeps too." }),
  fridge("r-creamy-dressing", "Sauces, spreads, jams", "Opened creamy-based dressings", "discard",
    ["ranch", "blue cheese dressing", "caesar dressing", "thousand island", "creamy dressing"], { opened: true, twin: "r-creamy-dressing-sealed" }),
  fridge("r-creamy-dressing-sealed", "Sauces, spreads, jams", "Creamy-based dressings, sealed", "sealed", ["sealed ranch", "unopened creamy dressing"],
    { opened: false, twin: "r-creamy-dressing", onChart: false }),
  fridge("r-pasta-sauce", "Sauces, spreads, jams", "Spaghetti sauce, opened", "discard", ["spaghetti sauce", "pasta sauce", "marinara", "tomato sauce"],
    { opened: true, twin: "r-pasta-sauce-sealed" }),
  fridge("r-pasta-sauce-sealed", "Sauces, spreads, jams", "Spaghetti sauce, sealed", "sealed", ["sealed jar of pasta sauce", "unopened marinara"],
    { opened: false, twin: "r-pasta-sauce", onChart: false }),

  // Bread, cakes, cookies, pasta, grains
  fridge("r-bread", "Bread, cakes, cookies, pasta, grains", "Bread, rolls, cakes, muffins, quick breads, tortillas", "keep",
    ["bread", "rolls", "cake", "muffins", "banana bread", "tortillas", "buns"], { move: "f-bread" }),
  fridge("r-dough", "Bread, cakes, cookies, pasta, grains", "Refrigerator biscuits, rolls, cookie dough", "discard",
    ["biscuit dough", "crescent rolls", "cookie dough", "pizza dough", "tube of dough"]),
  fridge("r-cooked-starch", "Bread, cakes, cookies, pasta, grains", "Cooked pasta, rice, potatoes", "discard",
    ["leftover rice", "cooked rice", "cooked pasta", "leftover pasta", "mashed potatoes", "cooked potatoes", "noodles"], { move: "f-casserole" }),
  fridge("r-pasta-salad", "Bread, cakes, cookies, pasta, grains", "Pasta salads with mayonnaise or vinaigrette", "discard", ["pasta salad", "macaroni salad"]),
  fridge("r-fresh-pasta", "Bread, cakes, cookies, pasta, grains", "Fresh pasta", "discard", ["fresh pasta", "ravioli", "tortellini", "gnocchi"]),
  fridge("r-cheesecake", "Bread, cakes, cookies, pasta, grains", "Cheesecake", "discard", ["cheesecake"], { move: "f-cheesecake" }),
  fridge("r-breakfast", "Bread, cakes, cookies, pasta, grains", "Breakfast foods: waffles, pancakes, bagels", "keep",
    ["waffles", "pancakes", "bagels", "english muffins"], { move: "f-breakfast" }),

  // Pies and pastry
  fridge("r-cream-pastry", "Pies and pastry", "Cream filled pastries", "discard", ["cream puffs", "eclairs", "cannoli", "cream filled donuts", "cream pastry"],
    { move: "f-custard-pastry" }),
  fridge("r-custard-pie", "Pies and pastry", "Pies: Any with filling containing eggs or milk, e.g., custard, cheese-filled, or chiffon; quiche.", "discard",
    ["pumpkin pie", "custard pie", "cream pie", "chiffon pie", "cheese pie", "lemon meringue pie", "pecan pie"], { move: "f-custard-pastry" }),
  fridge("r-fruit-pie", "Pies and pastry", "Fruit pies", "keep", ["apple pie", "cherry pie", "berry pie", "fruit pie"]),

  // Vegetables
  fridge("r-veg-cut", "Vegetables", "Fresh vegetables, cut", "discard",
    ["cut vegetables", "chopped onion", "sliced peppers", "cut carrots", "baby carrots", "veggie tray", "chopped vegetables"],
    { cut: true, twin: "r-veg-whole", move: "f-veg" }),
  fridge("r-veg-whole", "Vegetables", "Fresh vegetables, uncut", "keep",
    ["carrots", "celery", "broccoli", "lettuce head", "cucumber", "peppers", "tomatoes", "zucchini", "cabbage", "onions", "potatoes", "corn"],
    { cut: false, twin: "r-veg-cut", move: "f-veg" }),
  fridge("r-mushrooms-herbs", "Vegetables", "Fresh mushrooms, herbs, spices", "keep", ["mushrooms", "fresh herbs", "parsley", "cilantro", "basil", "ginger root"]),
  fridge("r-greens", "Vegetables", "Greens, pre-cut, pre-washed, packaged", "discard",
    ["bagged salad", "spring mix", "bagged spinach", "salad kit", "pre-washed greens", "bag of lettuce"]),
  fridge("r-veg-cooked", "Vegetables", "Vegetables, cooked", "discard", ["cooked vegetables", "leftover vegetables", "roasted vegetables", "stir fry"],
    { move: "f-veg" }),
  fridge("r-tofu", "Vegetables", "Tofu, cooked", "discard", ["cooked tofu", "tofu"]),
  fridge("r-veg-juice", "Vegetables", "Vegetable juice, opened", "discard", ["tomato juice", "v8", "vegetable juice", "carrot juice"],
    { opened: true, twin: "r-veg-juice-sealed", move: "f-veg-juice" }),
  fridge("r-veg-juice-sealed", "Vegetables", "Vegetable juice, sealed", "sealed", ["sealed vegetable juice"],
    { opened: false, twin: "r-veg-juice", onChart: false, move: "f-veg-juice" }),
  fridge("r-baked-potato", "Vegetables", "Baked potatoes", "discard", ["baked potato", "baked potatoes"]),
  fridge("r-garlic-oil", "Vegetables", "Commercial garlic in oil", "discard", ["garlic in oil", "minced garlic in oil", "garlic confit"]),
  fridge("r-potato-salad", "Vegetables", "Potato salad", "discard", ["potato salad"]),
];

export const FREEZER_ROWS: FreezerRow[] = [
  freezer("f-meat", "Meat, poultry, seafood", "Meat, poultry, seafood – all types of cuts", "refreeze", "discard",
    ["frozen chicken", "frozen beef", "frozen fish", "frozen shrimp", "ground beef", "steak", "frozen turkey", "sausage", "bacon"],
    { move: "r-meat" }),
  freezer("f-stews", "Meat, poultry, seafood", "Stews, soups", "refreeze", "discard", ["frozen soup", "frozen stew", "frozen chili", "broth"],
    { move: "r-casserole" }),
  freezer("f-milk", "Dairy", "Milk", "refreeze", "discard", ["frozen milk"], { iceNote: "Some loss of texture.", move: "r-milk" }),
  freezer("f-eggs", "Dairy", "Eggs (out of shell) and egg products", "refreeze", "discard", ["frozen eggs", "frozen egg whites", "egg substitute"],
    { move: "r-eggs" }),
  freezer("f-ice-cream", "Dairy", "Ice cream, frozen yogurt", "discard", "discard", ["ice cream", "frozen yogurt", "gelato", "ice cream bars"]),
  freezer("f-soft-cheese", "Dairy", "Cheese (soft and semi-soft)", "refreeze", "discard", ["frozen mozzarella", "frozen soft cheese"],
    { iceNote: "Some loss of texture.", move: "r-soft-cheese" }),
  freezer("f-hard-cheese", "Dairy", "Hard cheeses", "refreeze", "refreeze", ["frozen cheddar", "frozen parmesan"],
    { move: "r-hard-cheese" }),
  freezer("f-shredded-cheese", "Dairy", "Shredded cheeses", "refreeze", "discard", ["frozen shredded cheese"], { move: "r-shredded-cheese" }),
  freezer("f-cheesecake", "Dairy", "Cheesecake", "refreeze", "discard", ["frozen cheesecake"], { move: "r-cheesecake" }),
  freezer("f-fruit-juice", "Fruits", "Juices", "refreeze", "refreeze", ["frozen juice concentrate", "frozen orange juice"],
    { warmNote: "Discard if mold, yeasty smell, or sliminess develops.", move: "r-juice" }),
  freezer("f-fruit", "Fruits", "Home or commercially packaged", "refreeze", "refreeze", ["frozen berries", "frozen fruit", "frozen mango", "frozen strawberries"],
    { iceNote: "Will change texture and flavor.", warmNote: "Discard if mold, yeasty smell, or sliminess develops.", move: "r-fruit-cut" }),
  freezer("f-veg-juice", "Vegetables", "Juices", "refreeze", "discard-after-6h", ["frozen vegetable juice"], { move: "r-veg-juice" }),
  freezer("f-veg", "Vegetables", "Home or commercially packaged or blanched", "refreeze", "discard-after-6h",
    ["frozen peas", "frozen corn", "frozen broccoli", "frozen vegetables", "frozen spinach", "frozen green beans"],
    { iceNote: "May suffer texture and flavor loss.", move: "r-veg-cooked" }),
  freezer("f-bread", "Breads and pastries", "Breads, rolls, muffins, cakes (without custard fillings)", "refreeze", "refreeze",
    ["frozen bread", "frozen rolls", "frozen muffins", "frozen cake"], { move: "r-bread" }),
  freezer("f-custard-pastry", "Breads and pastries", "Cakes, pies, pastries with custard or cheese filling", "refreeze", "discard",
    ["frozen cream pie", "frozen custard pie", "frozen cheese danish"], { move: "r-custard-pie" }),
  freezer("f-dough", "Breads and pastries", "Pie crusts, commercial and homemade bread dough", "refreeze", "refreeze",
    ["frozen pie crust", "frozen bread dough", "frozen pizza dough", "frozen puff pastry"],
    { iceNote: "Some quality loss may occur.", warmNote: "Quality loss is considerable.", move: "r-dough" }),
  freezer("f-casserole", "Other foods", "Casseroles: pasta, rice-based", "refreeze", "discard", ["frozen lasagna", "frozen casserole", "frozen rice dish"],
    { move: "r-casserole" }),
  freezer("f-flour-nuts", "Other foods", "Flour, cornmeal, nuts", "refreeze", "refreeze", ["flour", "cornmeal", "nuts", "frozen nuts"]),
  freezer("f-breakfast", "Other foods", "Breakfast items: waffles, pancakes, bagels", "refreeze", "refreeze",
    ["frozen waffles", "frozen pancakes", "frozen bagels"], { move: "r-breakfast" }),
  freezer("f-meal", "Other foods", "Frozen meal, entree, specialty item (pizza, sausage and biscuit, meat pie, convenience foods)", "refreeze", "discard",
    ["frozen pizza", "frozen dinner", "frozen meal", "tv dinner", "frozen burritos", "frozen dumplings", "pot pie", "frozen entree"],
    { move: "r-pizza" }),
];

export const ROWS: Row[] = [...FRIDGE_ROWS, ...FREEZER_ROWS];
const BY_ID = new Map(ROWS.map((row) => [row.id, row]));

export function rowById(id: string | null | undefined): Row | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function rowsFor(place: Place): Row[] {
  return place === "fridge" ? FRIDGE_ROWS : FREEZER_ROWS;
}

/** Rows of one appliance's chart that match a search, best first: exact everyday word, then prefixes, then anywhere. */
export function searchRows(place: Place, query: string): Row[] {
  const q = query.trim().toLowerCase();
  if (!q) return rowsFor(place);
  const score = (row: Row) => {
    const label = row.label.toLowerCase();
    const words = row.words.map((w) => w.toLowerCase());
    if (words.includes(q)) return 0;
    if (words.some((w) => w.startsWith(q)) || label.startsWith(q)) return 1;
    if (label.includes(q) || words.some((w) => w.includes(q))) return 2;
    return 9;
  };
  return rowsFor(place)
    .map((row) => [score(row), row] as const)
    .filter(([s]) => s < 9)
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row);
}
