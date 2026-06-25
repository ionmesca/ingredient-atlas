#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const ROOT = resolve(new URL("..", import.meta.url).pathname)
const OUT_DIR = join(ROOT, "docs", "catalog-expansion", "v0.1.2")
const COMPACT_MANIFEST = join(ROOT, "data", "manifest.compact.json")
const SCHEMA_VERSION = "0.1.2-candidate"
const STYLE_PROMPT =
  "Clean isolated app asset on a pure white background, centered subject, soft natural studio light, no brand names, no packaging logos, no hands, no table, no text, no watermark."
const NON_FOOD_CLAIM_POLICY =
  "generic item metadata only; no efficacy, safety, dosage, or medical claims"
const FOOD_NUTRITION_CAUTION =
  "Do not publish nutrition values until they are source-backed and reviewed."

const foodCandidates = [
  alias("greek yoghurt", "Greek Yoghurt", "dairy", "greek-yogurt", [
    "Greek yogurt",
    "strained yoghurt",
  ]),
  alias("cooking olive oil", "Cooking Olive Oil", "pantry", "olive-oil", ["olive oil"]),
  alias("good olive oil", "Good Olive Oil", "pantry", "olive-oil", ["olive oil"]),
  alias("heavy whipping cream", "Heavy Whipping Cream", "dairy", "heavy-cream", [
    "heavy cream",
    "whipping cream",
  ]),
  food("thin sliced cheese", "Thin Sliced Cheese", "dairy", "cheese", ["sliced cheese"]),
  food("cotija cheese", "Cotija Cheese", "dairy", "cheese", [
    "queso cotija",
    "Mexican cotija cheese",
  ]),
  food("beans", "Beans", "legumes", "general", ["mixed beans", "dried beans"]),
  food("beef strips", "Beef Strips", "meat", "cut meat", ["beef slices", "stir fry beef"]),
  food("brown mushrooms", "Brown Mushrooms", "produce", "mushrooms", [
    "cremini mushrooms",
    "brown button mushrooms",
  ]),
  reviewOnly("castor oil", "Castor Oil", "personal", "better as personal-care item"),
  food("chocolate bunnies", "Chocolate Bunnies", "bakery", "seasonal sweets", [
    "chocolate rabbit",
    "Easter chocolate",
  ]),
  food("chocolate chips", "Chocolate Chips", "pantry", "baking", [
    "baking chips",
    "semi-sweet chocolate chips",
  ]),
  food("coffee beans", "Coffee Beans", "beverages", "coffee", [
    "whole coffee beans",
    "roasted coffee beans",
  ]),
  food("dry cottage cheese", "Dry Cottage Cheese", "dairy", "cheese", [
    "farmer cheese",
    "pressed cottage cheese",
  ]),
  reviewOnly("dry spices", "Dry Spices", "spices", "generic category, not an atomic item"),
  food("elbow macaroni", "Elbow Macaroni", "grains", "pasta", ["macaroni"]),
  food("falafel", "Falafel", "frozen", "prepared food", ["falafel balls"]),
  food("fish sticks", "Fish Sticks", "seafood", "prepared seafood", ["fish fingers"]),
  food("frozen fries", "Frozen Fries", "frozen", "frozen potatoes", [
    "frozen french fries",
  ]),
  food("frozen salmon patties", "Frozen Salmon Patties", "seafood", "prepared seafood", [
    "salmon burgers",
  ]),
  food("frozen vegetables", "Frozen Vegetables", "frozen", "mixed vegetables", [
    "mixed frozen vegetables",
  ]),
  reviewOnly("fruit", "Fruit", "produce", "generic category, not an atomic item"),
  reviewOnly("fruits", "Fruits", "produce", "generic category, not an atomic item"),
  food("melon", "Melon", "produce", "fruit", ["muskmelon"]),
  food("mild salsa", "Mild Salsa", "condiments", "salsa", ["salsa mild"]),
  food("mini mozzarella balls", "Mini Mozzarella Balls", "dairy", "cheese", [
    "ciliegine mozzarella",
    "mozzarella pearls",
  ]),
  food("mini sausages", "Mini Sausages", "meat", "sausage", [
    "cocktail sausages",
    "small sausages",
  ]),
  reviewOnly("mixed fruits", "Mixed Fruits", "produce", "generic category, not an atomic item"),
  food("milk snack cakes", "Milk Snack Cakes", "snacks", "packaged snack without brand styling", [
    "milk snack cakes",
  ]),
  food("pelmeni", "Pelmeni", "frozen", "dumplings", ["Russian dumplings"]),
  food("pineapple juice", "Pineapple Juice", "beverages", "juice", ["ananas juice"]),
  food("bear shaped potato snacks", "Bear-Shaped Potato Snacks", "snacks", "chips", [
    "bear-shaped potato snacks",
    "potato chips",
  ]),
  food("pomelo", "Pomelo", "produce", "citrus", ["pummelo"]),
  food("sandwich meat", "Sandwich Meat", "meat", "deli meat", [
    "deli slices",
    "cold cuts",
  ]),
  food("small sausages", "Small Sausages", "meat", "sausages", [
    "small German sausages",
    "cocktail wieners",
  ]),
  food("soup greens", "Soup Greens", "produce", "vegetable mix", [
    "soup vegetables",
    "suppengruen",
  ]),
  food("spring mix salad greens", "Spring Mix Salad Greens", "produce", "leafy greens", [
    "mixed salad greens",
  ]),
  food("star sprinkles", "Star Sprinkles", "pantry", "baking decoration", [
    "decorative sprinkles",
  ]),
  food("steak seasoning", "Steak Seasoning", "spices", "seasoning blend", [
    "beef seasoning",
  ]),
  food("sweet popcorn", "Sweet Popcorn", "snacks", "popcorn", ["kettle corn"]),
  reviewOnly("syrup", "Syrup", "pantry", "ambiguous; map to maple/corn/simple syrup first"),
  food("taco seasoning", "Taco Seasoning", "spices", "seasoning blend", [
    "taco spice mix",
  ]),
  food("toast", "Toast", "bakery", "bread", ["toasted bread"]),
  food("trail mix", "Trail Mix", "snacks", "snack mix", ["studentenfutter"]),
  food("vorgekochte kartoffeln", "Pre-Cooked Potatoes", "produce", "potatoes", [
    "cooked potatoes",
    "vorgekochte Kartoffeln",
  ]),
  split("cotija cheese or parmesan", "Cotija Cheese Or Parmesan", "dairy", [
    "cotija-cheese",
    "parmesan-cheese",
  ]),
  split("frozen peas and carrots", "Frozen Peas And Carrots", "frozen", [
    "frozen-peas",
    "carrot",
  ]),
  split("ground beef/pork mix", "Ground Beef/Pork Mix", "meat", [
    "ground-beef",
    "ground-pork",
  ]),
  split("half and half or cream", "Half And Half Or Cream", "dairy", [
    "half-and-half",
    "cream",
  ]),
  split("salt and pepper", "Salt And Pepper", "spices", ["salt", "black-pepper"]),
]

const historyNonFood = [
  home("clothes disinfectant", "Clothes Disinfectant", "household", "laundry"),
  home("bathroom spray", "Bathroom Spray", "household", "cleaning"),
  home("cleanser", "Cleanser", "personal", "skin care"),
  home("dental sticks", "Dental Sticks", "pet", "pet care"),
  home("diapers", "Diapers", "household", "baby"),
  home("freezer bags", "Freezer Bags", "household", "kitchen supplies"),
  home("kids bowls", "Kids Bowls", "household", "child care"),
  home("kids shampoo", "Kids Shampoo", "personal", "child care"),
  home("kids toothpaste", "Kids Toothpaste", "personal", "child care"),
  home("night magnesium", "Night Magnesium", "personal", "supplements"),
  home("pacifiers", "Pacifiers", "household", "baby"),
  home("paper towels", "Paper Towels", "household", "paper goods"),
  home("infant paracetamol", "Infant Paracetamol", "personal", "medicine"),
  home("pigment cream", "Pigment Cream", "personal", "skin care"),
  home("hand soap", "Hand Soap", "household", "cleaning"),
  home("shampoo", "Shampoo", "personal", "hair care"),
  home("small toy", "Small Toy", "household", "child care"),
  home("tissues", "Tissues", "household", "paper goods"),
  home("toilet paper", "Toilet Paper", "household", "paper goods"),
  home("travel toothpaste", "Travel Toothpaste", "personal", "oral care"),
  home("vitamin c", "Vitamin C", "personal", "supplements"),
  home("wax strips", "Wax Strips", "personal", "personal care"),
]

const seedNonFood = [
  ["all-purpose cleaner", "household", "cleaning"],
  ["glass cleaner", "household", "cleaning"],
  ["toilet bowl cleaner", "household", "cleaning"],
  ["disinfecting wipes", "household", "cleaning"],
  ["disinfectant spray", "household", "cleaning"],
  ["floor cleaner", "household", "cleaning"],
  ["wood polish", "household", "cleaning"],
  ["limescale remover", "household", "cleaning"],
  ["oven cleaner", "household", "cleaning"],
  ["dish soap", "household", "dish care"],
  ["dishwasher tablets", "household", "dish care"],
  ["dishwasher rinse aid", "household", "dish care"],
  ["dishwasher salt", "household", "dish care"],
  ["sponges", "household", "cleaning tools"],
  ["scrub brushes", "household", "cleaning tools"],
  ["microfiber cloths", "household", "cleaning tools"],
  ["trash bags", "household", "storage and bags"],
  ["recycling bags", "household", "storage and bags"],
  ["sandwich bags", "household", "storage and bags"],
  ["aluminum foil", "household", "kitchen supplies"],
  ["parchment paper", "household", "kitchen supplies"],
  ["plastic wrap", "household", "kitchen supplies"],
  ["coffee filters", "household", "kitchen supplies"],
  ["laundry detergent", "household", "laundry"],
  ["fabric softener", "household", "laundry"],
  ["stain remover", "household", "laundry"],
  ["oxygen bleach", "household", "laundry"],
  ["washing machine cleaner", "household", "laundry"],
  ["dryer sheets", "household", "laundry"],
  ["lint roller", "household", "laundry"],
  ["clothespins", "household", "laundry"],
  ["liquid hand soap", "household", "cleaning"],
  ["hand sanitizer", "personal", "hygiene"],
  ["air freshener", "household", "home care"],
  ["drain cleaner", "household", "cleaning"],
  ["rubber gloves", "household", "cleaning tools"],
  ["mop heads", "household", "cleaning tools"],
  ["broom refills", "household", "cleaning tools"],
  ["dustpan", "household", "cleaning tools"],
  ["storage bins", "household", "storage and bags"],
  ["conditioner", "personal", "hair care"],
  ["body wash", "personal", "hygiene"],
  ["bar soap", "personal", "hygiene"],
  ["toothbrushes", "personal", "oral care"],
  ["dental floss", "personal", "oral care"],
  ["mouthwash", "personal", "oral care"],
  ["deodorant", "personal", "hygiene"],
  ["face wash", "personal", "skin care"],
  ["moisturizer", "personal", "skin care"],
  ["sunscreen", "personal", "skin care"],
  ["lip balm", "personal", "skin care"],
  ["cotton swabs", "personal", "personal care"],
  ["cotton pads", "personal", "personal care"],
  ["razors", "personal", "personal care"],
  ["shaving cream", "personal", "personal care"],
  ["hair gel", "personal", "hair care"],
  ["hair ties", "personal", "hair care"],
  ["feminine pads", "personal", "period care"],
  ["tampons", "personal", "period care"],
  ["panty liners", "personal", "period care"],
  ["makeup remover", "personal", "skin care"],
  ["nail clippers", "personal", "personal care"],
  ["nail polish remover", "personal", "personal care"],
  ["contact lens solution", "personal", "eye care"],
  ["saline spray", "personal", "medicine"],
  ["bandages", "personal", "first aid"],
  ["antiseptic cream", "personal", "first aid"],
  ["pain reliever", "personal", "medicine"],
  ["fever reducer", "personal", "medicine"],
  ["thermometer covers", "personal", "medicine"],
  ["hand cream", "personal", "skin care"],
  ["body lotion", "personal", "skin care"],
  ["baby wipes", "household", "baby"],
  ["diaper cream", "personal", "baby"],
  ["baby shampoo", "personal", "baby"],
  ["bottle nipples", "household", "baby"],
  ["baby lotion", "personal", "baby"],
  ["training pants", "household", "baby"],
  ["baby laundry detergent", "household", "baby"],
  ["teething rings", "household", "baby"],
  ["child toothbrushes", "personal", "child care"],
  ["bath toys", "household", "child care"],
  ["dog food", "pet", "pet food"],
  ["cat food", "pet", "pet food"],
  ["cat litter", "pet", "pet care"],
  ["dog treats", "pet", "pet food"],
  ["cat treats", "pet", "pet food"],
  ["pet waste bags", "pet", "pet care"],
  ["pet shampoo", "pet", "pet care"],
  ["flea comb", "pet", "pet care"],
  ["pet wipes", "pet", "pet care"],
  ["pet bowls", "pet", "pet supplies"],
  ["aquarium filter cartridges", "pet", "pet supplies"],
  ["batteries", "household", "home utility"],
  ["light bulbs", "household", "home utility"],
  ["extension cord", "household", "home utility"],
  ["painter tape", "household", "home utility"],
  ["super glue", "household", "home utility"],
  ["packing tape", "household", "home utility"],
  ["zip ties", "household", "home utility"],
].map(([name, kind, subcategory]) => home(name, titleCase(name), kind, subcategory, "assumed-non-food-seed"))

const items = [
  ...foodCandidates,
  ...historyNonFood,
  ...seedNonFood,
].map((item) => ({
  id: `ia_candidate_${item.slug}`,
  schemaVersion: SCHEMA_VERSION,
  ...item,
}))

const manifest = JSON.parse(await readFile(COMPACT_MANIFEST, "utf8"))
const existingSlugs = new Set(Object.keys(manifest.recordsBySlug))
const errors = validate(items, existingSlugs)
if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const summary = summarize(items)
await mkdir(OUT_DIR, { recursive: true })
await writeFile(
  join(OUT_DIR, "catalog-expansion-candidates.json"),
  `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), summary, items }, null, 2)}\n`,
)
await writeFile(join(OUT_DIR, "catalog-expansion-candidates.csv"), toCsv(items))
await writeFile(join(OUT_DIR, "catalog-expansion-report.md"), toMarkdown(summary, items))

console.log(JSON.stringify({ outDir: OUT_DIR, ...summary }, null, 2))

function food(sourceName, displayName, category, subcategory, aliases = []) {
  return candidate({
    source: "beets-shopping-history",
    action: "generate-image",
    kind: "food",
    category,
    subcategory,
    sourceName,
    displayName,
    aliases,
    metadataPolicy: "food nutrition allowed when source-backed; otherwise best-effort with caution",
  })
}

function home(sourceName, displayName, kind, subcategory, source = "beets-shopping-history") {
  return candidate({
    source,
    action: "generate-image",
    kind,
    category: kind,
    subcategory,
    sourceName,
    displayName,
    aliases: [],
    metadataPolicy: "omit food nutrient fields; no medical claims; generic public name only",
  })
}

function alias(sourceName, displayName, category, targetSlug, aliases = []) {
  return candidate({
    source: "beets-shopping-history",
    action: "alias-only",
    kind: "food",
    category,
    subcategory: "alias",
    sourceName,
    displayName,
    aliases,
    targetSlug,
    metadataPolicy: "map to existing public food record; no new image",
  })
}

function split(sourceName, displayName, category, targetSlugs) {
  return candidate({
    source: "beets-shopping-history",
    action: "split-before-generation",
    kind: "food",
    category,
    subcategory: "compound item",
    sourceName,
    displayName,
    aliases: [],
    targetSlugs,
    metadataPolicy: "split into atomic records before image generation",
  })
}

function reviewOnly(sourceName, displayName, category, reason) {
  return candidate({
    source: "beets-shopping-history",
    action: "review-only",
    kind: category === "personal" ? "personal" : "food",
    category,
    subcategory: "ambiguous",
    sourceName,
    displayName,
    aliases: [],
    reviewReason: reason,
    metadataPolicy: "do not generate until manually resolved",
  })
}

function candidate(input) {
  const slug = slugify(input.displayName)
  return {
    slug,
    displayName: input.displayName,
    kind: input.kind,
    category: input.category,
    subcategory: input.subcategory,
    aliases: unique(input.aliases ?? []),
    source: input.source,
    sourceName: input.sourceName,
    action: input.action,
    targetSlug: input.targetSlug,
    targetSlugs: input.targetSlugs,
    publicNameReviewed: true,
    privacyReviewed: true,
    metadataPolicy: input.metadataPolicy,
    metadata: metadataFor(input),
    reviewReason: input.reviewReason,
    visual: {
      assetStatus: input.action === "generate-image" ? "queued" : "not-required",
      prompt: input.action === "generate-image" ? promptFor(input.displayName, input.kind, input.subcategory) : undefined,
      negativePrompt: input.action === "generate-image" ? "No brand names, no logos, no text, no hands, no people, no dark or colored background." : undefined,
      style: input.kind === "food" ? "Ingredient Atlas food asset" : "Ingredient Atlas household catalog asset",
    },
  }
}

function metadataFor(input) {
  if (input.kind === "food") {
    return {
      food: {
        nutritionStatus: "needs-source-review",
        nutritionCaution: FOOD_NUTRITION_CAUTION,
      },
    }
  }

  return {
    nonFood: {
      claimPolicy: NON_FOOD_CLAIM_POLICY,
      useContext: [input.subcategory].filter(Boolean),
    },
  }
}

function promptFor(displayName, kind, subcategory) {
  const noun = kind === "food" ? "ingredient or grocery item" : "household shopping item"
  return `${STYLE_PROMPT} Subject: ${displayName}, shown as a generic ${noun}. Category context: ${subcategory}.`
}

function summarize(rows) {
  const countsByAction = countBy(rows, "action")
  const countsByKind = countBy(rows, "kind")
  const nonFoodSeed = rows.filter((item) => item.source === "assumed-non-food-seed").length
  return {
    total: rows.length,
    countsByAction,
    countsByKind,
    nonFoodSeed,
    beetsHistoryCandidates: rows.filter((item) => item.source === "beets-shopping-history").length,
    generateImageCount: rows.filter((item) => item.action === "generate-image").length,
  }
}

function validate(rows, existingSlugs) {
  const errors = []
  const seen = new Set()
  for (const item of rows) {
    if (seen.has(item.slug)) errors.push(`duplicate slug ${item.slug}`)
    seen.add(item.slug)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) errors.push(`${item.slug}: invalid slug`)
    if (/(felix|vlad|test)/i.test(`${item.sourceName} ${item.displayName}`)) {
      errors.push(`${item.slug}: private or test text leaked into public candidate`)
    }
    if (item.kind !== "food" && /nutrition/i.test(item.metadataPolicy)) {
      errors.push(`${item.slug}: non-food item references nutrition wording`)
    }
    if (item.action === "generate-image" && !item.visual?.prompt) {
      errors.push(`${item.slug}: missing image prompt`)
    }
    if (item.action === "alias-only" && !existingSlugs.has(item.targetSlug)) {
      errors.push(`${item.slug}: alias target ${item.targetSlug} does not exist`)
    }
    for (const target of item.targetSlugs ?? []) {
      if (!existingSlugs.has(target) && !rows.some((row) => row.slug === target)) {
        errors.push(`${item.slug}: split target ${target} is neither existing nor queued`)
      }
    }
  }
  if (rows.filter((item) => item.source === "assumed-non-food-seed").length !== 100) {
    errors.push("expected exactly 100 assumed non-food seed candidates")
  }
  return errors
}

function countBy(rows, key) {
  return Object.fromEntries(
    [...rows.reduce((map, row) => map.set(row[key], (map.get(row[key]) ?? 0) + 1), new Map())].sort(),
  )
}

function toCsv(rows) {
  const header = [
    "action",
    "kind",
    "slug",
    "displayName",
    "category",
    "subcategory",
    "source",
    "targetSlug",
    "targetSlugs",
    "metadataPolicy",
  ]
  return `${header.join(",")}\n${rows
    .map((item) =>
      header
        .map((key) => {
          const value = Array.isArray(item[key]) ? item[key].join("|") : item[key]
          return csv(value ?? "")
        })
        .join(","),
    )
    .join("\n")}\n`
}

function toMarkdown(summary, rows) {
  const generateRows = rows.filter((item) => item.action === "generate-image")
  const aliasRows = rows.filter((item) => item.action === "alias-only")
  const splitRows = rows.filter((item) => item.action === "split-before-generation")
  return `# v0.1.2 Catalog Expansion Review

Generated by \`npm run catalog:prepare\`.

## Summary

- Total reviewed candidate rows: ${summary.total}
- Image-generation queue: ${summary.generateImageCount}
- Beets shopping-history candidates: ${summary.beetsHistoryCandidates}
- Assumed non-food seed candidates: ${summary.nonFoodSeed}
- Action counts: ${JSON.stringify(summary.countsByAction)}
- Kind counts: ${JSON.stringify(summary.countsByKind)}

## Decision

Do not mix household and personal items into the food nutrition model. Keep one catalog manifest, but make each record carry \`kind\`: \`food\`, \`household\`, \`personal\`, or \`pet\`. Food records may carry nutrition with caution labels. Non-food records must not carry nutrition and must avoid medical, safety, or efficacy claims.

## Visual Direction

All queued assets should follow the same broad visual language as Ingredient Atlas: isolated object, centered, pure white background, soft studio light, no brand names, no logos, no text, no hands, no people, and no lifestyle context. Household objects can show generic packaging only when the item is not understandable without it, but the package must be blank.

## Alias-Only Fixes

${table(aliasRows, ["displayName", "targetSlug", "metadataPolicy"])}

## Split Before Generation

${table(splitRows, ["displayName", "targetSlugs", "metadataPolicy"])}

## Image Queue Preview

${table(generateRows.slice(0, 80), ["kind", "displayName", "category", "subcategory", "source"])}

Full candidate data is in \`catalog-expansion-candidates.json\` and \`catalog-expansion-candidates.csv\`.
`
}

function table(rows, fields) {
  if (rows.length === 0) return "None.\n"
  const header = `| ${fields.join(" | ")} |`
  const sep = `| ${fields.map(() => "---").join(" | ")} |`
  const body = rows
    .map((row) => `| ${fields.map((field) => md(Array.isArray(row[field]) ? row[field].join(", ") : row[field] ?? "")).join(" | ")} |`)
    .join("\n")
  return `${header}\n${sep}\n${body}\n`
}

function titleCase(value) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

function csv(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function md(value) {
  return String(value).replace(/\|/g, "/")
}
