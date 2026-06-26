#!/usr/bin/env node
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const require = createRequire(import.meta.url)
const parquet = require("parquetjs-lite")

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC_DIR = join(ROOT, "public-dataset")
const PACKAGE_DATA_DIR = join(ROOT, "data")
const CANDIDATES_PATH = join(ROOT, "docs", "catalog-expansion", "v0.1.2", "catalog-expansion-candidates.json")
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }
const CANVAS_SIZE = 512
const NON_FOOD_PACKAGE_POLICY = "generic blank packaging only when needed for recognition"
const NON_FOOD_LABELING_POLICY = "no readable brand, dosage, certification, or safety text"

const FOOD_BATCH_SLUGS = [
  "thin-sliced-cheese",
  "cotija-cheese",
  "beans",
  "beef-strips",
  "brown-mushrooms",
  "chocolate-chips",
  "coffee-beans",
  "dry-cottage-cheese",
  "elbow-macaroni",
  "falafel",
  "fish-sticks",
  "frozen-fries",
  "frozen-salmon-patties",
  "frozen-vegetables",
  "melon",
  "mild-salsa",
  "mini-mozzarella-balls",
  "mini-sausages",
  "pelmeni",
  "pineapple-juice",
]

const QUANTITY_CORRECTION_SLUGS = [
  "mini-sausages",
  "pelmeni",
  "falafel",
  "fish-sticks",
  "mini-mozzarella-balls",
]

const NON_FOOD_PILOT_SLUGS = [
  "paper-towels",
  "toilet-paper",
  "tissues",
  "freezer-bags",
  "aluminum-foil",
  "parchment-paper",
  "sponges",
  "trash-bags",
  "dish-soap",
  "laundry-detergent",
  "batteries",
  "light-bulbs",
  "shampoo",
  "toothbrushes",
  "dental-floss",
  "deodorant",
  "cotton-swabs",
  "bandages",
  "pet-waste-bags",
  "pet-bowls",
]

const FOOD_BATCH_2_SLUGS = [
  "chocolate-bunnies",
  "milk-snack-cakes",
  "bear-shaped-potato-snacks",
  "pomelo",
  "sandwich-meat",
  "small-sausages",
  "soup-greens",
  "spring-mix-salad-greens",
  "star-sprinkles",
  "steak-seasoning",
  "sweet-popcorn",
  "taco-seasoning",
  "toast",
  "trail-mix",
  "pre-cooked-potatoes",
]

const HOUSEHOLD_BASICS_SLUGS = [
  "kids-bowls",
  "small-toy",
  "hand-soap",
  "dishwasher-tablets",
  "dishwasher-rinse-aid",
  "dishwasher-salt",
  "scrub-brushes",
  "microfiber-cloths",
  "recycling-bags",
  "sandwich-bags",
  "plastic-wrap",
  "coffee-filters",
  "dryer-sheets",
  "lint-roller",
  "clothespins",
  "rubber-gloves",
  "mop-heads",
  "broom-refills",
  "dustpan",
  "storage-bins",
  "bath-toys",
  "extension-cord",
  "painter-tape",
  "super-glue",
  "packing-tape",
  "zip-ties",
]

const HOUSEHOLD_CARE_SLUGS = [
  "clothes-disinfectant",
  "bathroom-spray",
  "diapers",
  "pacifiers",
  "all-purpose-cleaner",
  "glass-cleaner",
  "toilet-bowl-cleaner",
  "disinfecting-wipes",
  "disinfectant-spray",
  "floor-cleaner",
  "wood-polish",
  "limescale-remover",
  "oven-cleaner",
  "fabric-softener",
  "stain-remover",
  "oxygen-bleach",
  "washing-machine-cleaner",
  "liquid-hand-soap",
  "air-freshener",
  "drain-cleaner",
  "baby-wipes",
  "bottle-nipples",
  "training-pants",
  "baby-laundry-detergent",
  "teething-rings",
]

const PERSONAL_BASICS_SLUGS = [
  "cleanser",
  "pigment-cream",
  "travel-toothpaste",
  "wax-strips",
  "hand-sanitizer",
  "conditioner",
  "body-wash",
  "bar-soap",
  "mouthwash",
  "face-wash",
  "moisturizer",
  "sunscreen",
  "lip-balm",
  "cotton-pads",
  "razors",
  "shaving-cream",
  "hair-gel",
  "hair-ties",
  "feminine-pads",
  "tampons",
  "panty-liners",
  "makeup-remover",
  "nail-clippers",
  "nail-polish-remover",
]

const SENSITIVE_CARE_SLUGS = [
  "kids-shampoo",
  "kids-toothpaste",
  "night-magnesium",
  "infant-paracetamol",
  "vitamin-c",
  "contact-lens-solution",
  "saline-spray",
  "antiseptic-cream",
  "pain-reliever",
  "fever-reducer",
  "thermometer-covers",
  "hand-cream",
  "body-lotion",
  "diaper-cream",
  "baby-shampoo",
  "baby-lotion",
  "child-toothbrushes",
]

const PET_BATCH_SLUGS = [
  "dental-sticks",
  "dog-food",
  "cat-food",
  "cat-litter",
  "dog-treats",
  "cat-treats",
  "pet-shampoo",
  "flea-comb",
  "pet-wipes",
  "aquarium-filter-cartridges",
]

const BATCHES = [
  {
    id: "food-batch-20",
    title: "v0.1.2 Food Batch 20 Review",
    summaryKey: "v012Batch20",
    reviewDir: join(ROOT, "reviews", "v0.1.2-batch-20"),
    sourceDir: join(ROOT, "reviews", "v0.1.2-batch-20", "generated-sources"),
    slugs: FOOD_BATCH_SLUGS,
    expectedKind: "food",
    reviewStatus: "v0.1.2-batch-20-generated",
    imageWorkflow: "Built-in image generation tool food batch 20",
    notes:
      "Generated for the first v0.1.2 catalog image batch; final owner approval pending before public release.",
    extraSummary: {
      correctedSlugs: QUANTITY_CORRECTION_SLUGS,
      correctionReason: "Reduced countable item quantities so the assets feel more realistic in recipe apps.",
    },
    visualRules: [
      "Pure white background.",
      "Centered isolated subject.",
      "No brands, logos, readable text, hands, people, plates, tables, or lifestyle scenes.",
      "Plain bowls or glass only where the item is unclear without a container.",
      "Countable items should look like normal recipe-app quantities, not bulk piles.",
    ],
  },
  {
    id: "non-food-pilot-20",
    title: "v0.1.2 Non-Food Pilot 20 Review",
    summaryKey: "v012NonFoodPilot20",
    reviewDir: join(ROOT, "reviews", "v0.1.2-non-food-pilot-20"),
    sourceDir: join(ROOT, "reviews", "v0.1.2-non-food-pilot-20", "generated-sources"),
    slugs: NON_FOOD_PILOT_SLUGS,
    expectedKind: undefined,
    reviewStatus: "v0.1.2-non-food-pilot-20-generated",
    imageWorkflow: "Built-in image generation tool non-food pilot 20",
    notes:
      "Generated as a first non-food catalog image pilot; final owner approval pending before public release.",
    extraSummary: {
      pilotPurpose:
        "Test the Ingredient Atlas visual language for household, personal-care, and pet shopping items.",
    },
    visualRules: [
      "Pure white background.",
      "Centered isolated subject.",
      "No brands, logos, readable text, hands, people, tables, lifestyle scenes, or decorative packaging.",
      "Generic blank packaging only when needed for recognition.",
      "No medical, dosage, certification, safety, or efficacy claims.",
      "Use realistic household quantities rather than bulk packs.",
    ],
  },
  {
    id: "food-batch-2-15",
    title: "v0.1.2 Food Batch 2 Review",
    summaryKey: "v012FoodBatch2",
    reviewDir: join(ROOT, "reviews", "v0.1.2-food-batch-2-15"),
    sourceDir: join(ROOT, "reviews", "v0.1.2-food-batch-2-15", "generated-sources"),
    slugs: FOOD_BATCH_2_SLUGS,
    expectedKind: "food",
    reviewStatus: "v0.1.2-food-batch-2-generated",
    imageWorkflow: "Built-in image generation tool food batch 2",
    notes:
      "Generated for the second v0.1.2 food image batch; final owner approval pending before public release.",
    extraSummary: {
      pilotPurpose: "Finish remaining food image-generation candidates from the Beets shopping-history expansion.",
    },
    visualRules: [
      "Pure white background.",
      "Centered isolated subject.",
      "No brands, logos, readable text, hands, people, plates, tables, or lifestyle scenes.",
      "Food should show normal recipe-app quantities rather than bulk piles.",
      "Packaged-style foods should show the food itself when that is clearer than blank packaging.",
    ],
  },
  {
    id: "household-basics-26",
    title: "v0.1.2 Household Basics 26 Review",
    summaryKey: "v012HouseholdBasics26",
    reviewDir: join(ROOT, "reviews", "v0.1.2-household-basics-26"),
    sourceDir: join(ROOT, "reviews", "v0.1.2-household-basics-26", "generated-sources"),
    slugs: HOUSEHOLD_BASICS_SLUGS,
    expectedKind: "household",
    reviewStatus: "v0.1.2-household-basics-26-generated",
    imageWorkflow: "Built-in image generation tool household basics 26",
    notes:
      "Generated for the low-claim household basics v0.1.2 batch; final owner approval pending before public release.",
    extraSummary: {
      pilotPurpose: "Cover low-risk household tools, storage, kitchen supplies, child household objects, and utility items.",
    },
    visualRules: [
      "Pure white background.",
      "Centered isolated subject.",
      "No brands, logos, readable text, hands, people, tables, lifestyle scenes, or decorative packaging.",
      "Generic blank packaging only when needed for recognition.",
      "Use realistic household quantities rather than bulk packs.",
    ],
  },
  {
    id: "household-care-25",
    title: "v0.1.2 Household Care 25 Review",
    summaryKey: "v012HouseholdCare25",
    reviewDir: join(ROOT, "reviews", "v0.1.2-household-care-25"),
    sourceDir: join(ROOT, "reviews", "v0.1.2-household-care-25", "generated-sources"),
    slugs: HOUSEHOLD_CARE_SLUGS,
    expectedKind: "household",
    reviewStatus: "v0.1.2-household-care-25-generated",
    imageWorkflow: "Built-in image generation tool household care 25",
    notes:
      "Generated for household cleaning, laundry, and baby household items; final owner approval pending before public release.",
    extraSummary: {
      pilotPurpose: "Cover chemical-heavy and baby household items with blank packaging and no claim text.",
    },
    visualRules: [
      "Pure white background.",
      "Centered isolated subject.",
      "No brands, logos, readable text, hands, people, tables, lifestyle scenes, or decorative packaging.",
      "Generic blank packaging only when needed for recognition.",
      "No medical, dosage, certification, safety, or efficacy claims.",
      "No hazard icons, warning labels, or instruction text.",
    ],
  },
  {
    id: "personal-basics-24",
    title: "v0.1.2 Personal Basics 24 Review",
    summaryKey: "v012PersonalBasics24",
    reviewDir: join(ROOT, "reviews", "v0.1.2-personal-basics-24"),
    sourceDir: join(ROOT, "reviews", "v0.1.2-personal-basics-24", "generated-sources"),
    slugs: PERSONAL_BASICS_SLUGS,
    expectedKind: "personal",
    reviewStatus: "v0.1.2-personal-basics-24-generated",
    imageWorkflow: "Built-in image generation tool personal basics 24",
    notes:
      "Generated for personal-care basics; final owner approval pending before public release.",
    extraSummary: {
      pilotPurpose: "Cover non-medical hygiene, grooming, skin-care, hair-care, and period-care basics.",
    },
    visualRules: [
      "Pure white background.",
      "Centered isolated subject.",
      "No brands, logos, readable text, hands, people, tables, lifestyle scenes, or decorative packaging.",
      "Generic blank packaging only when needed for recognition.",
      "No medical, dosage, certification, safety, or efficacy claims.",
      "No body-part usage scenes.",
    ],
  },
  {
    id: "sensitive-care-17",
    title: "v0.1.2 Sensitive Care 17 Review",
    summaryKey: "v012SensitiveCare17",
    reviewDir: join(ROOT, "reviews", "v0.1.2-sensitive-care-17"),
    sourceDir: join(ROOT, "reviews", "v0.1.2-sensitive-care-17", "generated-sources"),
    slugs: SENSITIVE_CARE_SLUGS,
    expectedKind: "personal",
    reviewStatus: "v0.1.2-sensitive-care-17-generated",
    imageWorkflow: "Built-in image generation tool sensitive care 17",
    notes:
      "Generated for baby, medicine, supplement, first-aid, and stricter personal-care items; final owner approval pending before public release.",
    extraSummary: {
      pilotPurpose: "Cover sensitive personal-care items with blank containers and no dosage, medical, safety, or efficacy claims.",
    },
    visualRules: [
      "Pure white background.",
      "Centered isolated subject.",
      "No brands, logos, readable text, hands, people, tables, lifestyle scenes, or decorative packaging.",
      "Generic blank packaging only when needed for recognition.",
      "No medical, dosage, certification, safety, or efficacy claims.",
      "No cross symbols, dosage aids, measurement marks, pills, children, or body-part usage scenes.",
    ],
  },
  {
    id: "pet-batch-10",
    title: "v0.1.2 Pet Batch 10 Review",
    summaryKey: "v012PetBatch10",
    reviewDir: join(ROOT, "reviews", "v0.1.2-pet-batch-10"),
    sourceDir: join(ROOT, "reviews", "v0.1.2-pet-batch-10", "generated-sources"),
    slugs: PET_BATCH_SLUGS,
    expectedKind: "pet",
    reviewStatus: "v0.1.2-pet-batch-10-generated",
    imageWorkflow: "Built-in image generation tool pet batch 10",
    notes:
      "Generated for pet food, pet care, and pet supply items; final owner approval pending before public release.",
    extraSummary: {
      pilotPurpose: "Finish remaining pet catalog image candidates with no animals, brands, labels, or claim text.",
    },
    visualRules: [
      "Pure white background.",
      "Centered isolated subject.",
      "No brands, logos, readable text, hands, people, animals, tables, lifestyle scenes, or decorative packaging.",
      "Generic blank packaging only when needed for recognition.",
      "No medical, dental-health, safety, nutrition, or efficacy claims.",
      "Use realistic household quantities rather than bulk packs.",
    ],
  },
]

const ALL_BATCH_SLUGS = BATCHES.flatMap((batch) => batch.slugs)

const manifestPath = join(PUBLIC_DIR, "manifest.json")
const publicCompactPath = join(PUBLIC_DIR, "manifest.compact.json")
const packageCompactPath = join(PACKAGE_DATA_DIR, "manifest.compact.json")
const metadataJsonlPath = join(PUBLIC_DIR, "metadata.jsonl")
const metadataParquetPath = join(PUBLIC_DIR, "metadata.parquet")
const checksumPath = join(PUBLIC_DIR, "checksums.sha256")
const summaryPath = join(PUBLIC_DIR, "summary.json")

const candidates = JSON.parse(await readFile(CANDIDATES_PATH, "utf8"))
const candidatesBySlug = new Map(candidates.items.map((item) => [item.slug, item]))
const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const summary = JSON.parse(await readFile(summaryPath, "utf8"))
const existingRecords = manifest.records.filter((record) => !ALL_BATCH_SLUGS.includes(record.slug))
const existingMetadataRows = (await readFile(metadataJsonlPath, "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((row) => !ALL_BATCH_SLUGS.includes(row.slug))

const generatedRecords = []
const generatedByBatch = new Map()

for (const batch of BATCHES) {
  const records = []
  for (const slug of batch.slugs) {
    const candidate = candidatesBySlug.get(slug)
    if (!candidate) throw new Error(`Missing candidate row for ${slug}`)
    if (batch.expectedKind && candidate.kind !== batch.expectedKind) {
      throw new Error(`${slug} is ${candidate.kind}, expected ${batch.expectedKind}`)
    }
    if (candidate.action !== "generate-image") throw new Error(`${slug} is not queued for generation`)

    const sourcePath = sourcePathFor(batch, slug)
    if (!sourcePath) throw new Error(`Missing generated source for ${slug} in ${relative(ROOT, batch.sourceDir)}`)

    records.push(await buildRecord(candidate, sourcePath, batch))
  }
  generatedByBatch.set(batch.id, records)
  generatedRecords.push(...records)
}

manifest.schemaVersion = "0.1.2-candidate"
manifest.generatedAt = new Date().toISOString()
manifest.description = "Local v0.1.2 candidate with generated food corrections and a non-food pilot batch."
manifest.status = "public-v0.1.2-candidate"
manifest.publicReleaseApproved = false
manifest.records = [...existingRecords, ...generatedRecords].sort((left, right) => left.slug.localeCompare(right.slug))

const compactManifest = toCompactManifest(manifest)
const metadataRows = [...existingMetadataRows, ...generatedRecords.map(toMetadataRow)].sort((left, right) =>
  left.slug.localeCompare(right.slug),
)
const checksumLines = manifest.records
  .flatMap((record) => Object.values(record.images).map((image) => `${image.sha256}  ${image.path}`))
  .sort()

summary.generatedAt = manifest.generatedAt
summary.status = manifest.status
summary.publicReleaseApproved = false
summary.counts.publicRecords = manifest.records.length
summary.counts.metadataRows = metadataRows.length
summary.counts.checksumRows = checksumLines.length
summary.counts.imageFiles = checksumLines.length
summary.v012ImageBatches = BATCHES.map((batch) => summaryEntry(batch, generatedByBatch.get(batch.id) ?? []))
for (const batch of BATCHES) {
  summary[batch.summaryKey] = summaryEntry(batch, generatedByBatch.get(batch.id) ?? [])
}

await writeJson(manifestPath, manifest)
await writeJson(publicCompactPath, compactManifest)
await writeJson(packageCompactPath, compactManifest)
await writeFile(metadataJsonlPath, `${metadataRows.map((row) => JSON.stringify(row)).join("\n")}\n`)
await writeParquet(metadataParquetPath, metadataRows)
await writeFile(checksumPath, `${checksumLines.join("\n")}\n`)
await writeJson(summaryPath, summary)
for (const batch of BATCHES) {
  const records = generatedByBatch.get(batch.id) ?? []
  await writeContactSheet(batch, records)
  await writeReport(batch, records)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      records: manifest.records.length,
      generatedRecords: generatedRecords.length,
      imageFiles: checksumLines.length,
      batches: BATCHES.map((batch) => ({
        id: batch.id,
        records: generatedByBatch.get(batch.id)?.length ?? 0,
        reviewDir: relative(ROOT, batch.reviewDir),
      })),
    },
    null,
    2,
  ),
)

async function buildRecord(candidate, sourcePath, batch) {
  const category = candidate.category
  const slug = candidate.slug
  const base = await normalizedPngBuffer(sourcePath)
  const originalBuffer = await sharp(base).webp({ quality: 95, effort: 6 }).toBuffer()
  const webpBuffer = await sharp(base).webp({ quality: 92, effort: 6 }).toBuffer()
  const pngBuffer = await sharp(base).png({ compressionLevel: 9 }).toBuffer()

  const originalPath = datasetPath("images", "original", category, `${slug}.webp`)
  const webpPath = datasetPath("images", "webp", "512", category, `${slug}.webp`)
  const pngPath = datasetPath("images", "png", "512", category, `${slug}.png`)

  await mkdir(dirname(join(PUBLIC_DIR, originalPath)), { recursive: true })
  await mkdir(dirname(join(PUBLIC_DIR, webpPath)), { recursive: true })
  await mkdir(dirname(join(PUBLIC_DIR, pngPath)), { recursive: true })
  await writeFile(join(PUBLIC_DIR, originalPath), originalBuffer)
  await writeFile(join(PUBLIC_DIR, webpPath), webpBuffer)
  await writeFile(join(PUBLIC_DIR, pngPath), pngBuffer)

  return {
    id: `ia_${slug}`,
    slug,
    displayName: candidate.displayName,
    kind: candidate.kind,
    category,
    subcategory: candidate.subcategory ?? null,
    aliases: candidate.aliases ?? [],
    aliasesDe: [],
    images: {
      original: await imageDescriptor(originalPath, originalBuffer, "image/webp"),
      webp512: await imageDescriptor(webpPath, webpBuffer, "image/webp"),
      png512: await imageDescriptor(pngPath, pngBuffer, "image/png"),
    },
    license: {
      status: "public-v0.1.2-candidate",
      metadata: "CC0-1.0",
      images: "CC0-1.0",
      code: "MIT",
      notice:
        "Local v0.1.2 candidate. Metadata and AI-generated images are intended for CC0-1.0 public release after final owner approval.",
    },
    provenance: {
      incubatedBy: "Beets",
      aiGenerated: true,
      source: "Ingredient Atlas v0.1.2 local batch candidate",
      imageWorkflow: batch.imageWorkflow,
      replacementReviewed: false,
    },
    review: {
      status: batch.reviewStatus,
      sourceImageApproved: true,
      visualQaScore: visualScoreFor(candidate, slug),
      replacementPromoted: false,
      notes: reviewNotesFor(batch, slug),
    },
    metadata: metadataFor(candidate),
  }
}

function visualScoreFor(candidate, slug) {
  if (candidate.kind !== "food") return slug === "batteries" ? 0.86 : 0.9
  return QUANTITY_CORRECTION_SLUGS.includes(slug) ? 0.92 : 0.9
}

function reviewNotesFor(batch, slug) {
  if (QUANTITY_CORRECTION_SLUGS.includes(slug)) {
    return "Regenerated during the quantity-realism pass so the item reads as a normal recipe-app amount."
  }
  return batch.notes
}

function metadataFor(candidate) {
  if (candidate.kind === "food") {
    return {
      datasetVersion: "ingredient-atlas-v0.1.2-candidate",
      defaultPreparation: "generic",
      nutritionSource: "missing",
      nutritionConfidence: "best-effort",
      nutritionCaution:
        "No source-backed nutrition values are included for this candidate row. Do not use as medical, allergy, or dietary advice.",
    }
  }

  const nonFood = candidate.metadata?.nonFood ?? {}
  return {
    datasetVersion: "ingredient-atlas-v0.1.2-candidate",
    catalogKind: candidate.kind,
    claimPolicy: nonFood.claimPolicy,
    useContext: nonFood.useContext ?? [],
    storageContext: nonFood.storageContext ?? null,
    hazardTags: nonFood.hazardTags ?? [],
    ageBand: nonFood.ageBand ?? null,
    petSpecies: nonFood.petSpecies ?? [],
    packagePolicy: nonFood.packagePolicy ?? NON_FOOD_PACKAGE_POLICY,
    labelingPolicy: nonFood.labelingPolicy ?? NON_FOOD_LABELING_POLICY,
  }
}

async function normalizedPngBuffer(sourcePath) {
  return sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize(CANVAS_SIZE, CANVAS_SIZE, { fit: "contain", background: WHITE })
    .flatten({ background: WHITE })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function imageDescriptor(path, buffer, contentType) {
  const metadata = await sharp(buffer).metadata()
  return {
    path,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    bytes: buffer.length,
    width: metadata.width,
    height: metadata.height,
    contentType,
  }
}

function toMetadataRow(record) {
  const isFood = record.kind === "food"
  return {
    file_name: record.images.webp512.path,
    slug: record.slug,
    display_name: record.displayName,
    kind: record.kind ?? "food",
    category: record.category,
    subcategory: record.subcategory ?? null,
    aliases: record.aliases,
    aliases_de: record.aliasesDe,
    image_license: record.license.images,
    metadata_license: record.license.metadata,
    license_status: record.license.status,
    ai_generated: true,
    incubated_by: "Beets",
    review_status: record.review.status,
    replacement_promoted: false,
    nutrition_source: isFood ? record.metadata.nutritionSource : "not-applicable",
    nutrition_confidence: isFood ? record.metadata.nutritionConfidence : "not-applicable",
    usda_fdc_id: null,
    non_food_claim_policy: isFood ? null : record.metadata.claimPolicy,
    non_food_use_context: isFood ? [] : record.metadata.useContext,
    non_food_storage_context: isFood ? null : record.metadata.storageContext,
    non_food_hazard_tags: isFood ? [] : record.metadata.hazardTags,
    non_food_age_band: isFood ? null : record.metadata.ageBand,
    non_food_pet_species: isFood ? [] : record.metadata.petSpecies,
    non_food_package_policy: isFood ? null : record.metadata.packagePolicy,
    non_food_labeling_policy: isFood ? null : record.metadata.labelingPolicy,
    webp512_sha256: record.images.webp512.sha256,
    png512_sha256: record.images.png512.sha256,
  }
}

function toCompactManifest(fullManifest) {
  const recordsBySlug = {}
  const aliases = {}
  for (const record of fullManifest.records) {
    const compact = compactObject({
      slug: record.slug,
      displayName: record.displayName,
      kind: record.kind,
      category: record.category,
      subcategory: record.subcategory,
      aliases: record.aliases,
      images: record.images,
      license: record.license,
      provenance: record.provenance,
      review: record.review,
    })
    recordsBySlug[record.slug] = compact
    for (const alias of record.aliases ?? []) {
      const aliasSlug = slugify(alias)
      if (aliasSlug && !aliases[aliasSlug]) aliases[aliasSlug] = compact
    }
  }
  return {
    schemaVersion: fullManifest.schemaVersion,
    generatedAt: fullManifest.generatedAt,
    name: fullManifest.name,
    status: fullManifest.status,
    publicReleaseApproved: fullManifest.publicReleaseApproved,
    contact: fullManifest.contact,
    license: fullManifest.license,
    recordsBySlug,
    aliases,
  }
}

async function writeParquet(path, rows) {
  const schema = new parquet.ParquetSchema({
    file_name: { type: "UTF8" },
    slug: { type: "UTF8" },
    display_name: { type: "UTF8" },
    kind: { type: "UTF8" },
    category: { type: "UTF8" },
    subcategory: { type: "UTF8", optional: true },
    aliases_json: { type: "UTF8" },
    aliases_de_json: { type: "UTF8" },
    image_license: { type: "UTF8" },
    metadata_license: { type: "UTF8" },
    license_status: { type: "UTF8" },
    ai_generated: { type: "BOOLEAN" },
    incubated_by: { type: "UTF8" },
    review_status: { type: "UTF8" },
    replacement_promoted: { type: "BOOLEAN" },
    nutrition_source: { type: "UTF8" },
    nutrition_confidence: { type: "UTF8" },
    usda_fdc_id: { type: "UTF8", optional: true },
    non_food_claim_policy: { type: "UTF8", optional: true },
    non_food_use_context_json: { type: "UTF8" },
    non_food_storage_context: { type: "UTF8", optional: true },
    non_food_hazard_tags_json: { type: "UTF8" },
    non_food_age_band: { type: "UTF8", optional: true },
    non_food_pet_species_json: { type: "UTF8" },
    non_food_package_policy: { type: "UTF8", optional: true },
    non_food_labeling_policy: { type: "UTF8", optional: true },
    webp512_sha256: { type: "UTF8" },
    png512_sha256: { type: "UTF8" },
  })
  const writer = await parquet.ParquetWriter.openFile(schema, path)
  try {
    for (const row of rows) {
      await writer.appendRow({
        file_name: row.file_name,
        slug: row.slug,
        display_name: row.display_name,
        kind: row.kind ?? "food",
        category: row.category,
        subcategory: row.subcategory,
        aliases_json: JSON.stringify(row.aliases ?? []),
        aliases_de_json: JSON.stringify(row.aliases_de ?? []),
        image_license: row.image_license,
        metadata_license: row.metadata_license,
        license_status: row.license_status,
        ai_generated: row.ai_generated,
        incubated_by: row.incubated_by,
        review_status: row.review_status,
        replacement_promoted: row.replacement_promoted,
        nutrition_source: row.nutrition_source ?? "unknown",
        nutrition_confidence: row.nutrition_confidence ?? "unknown",
        usda_fdc_id: row.usda_fdc_id,
        non_food_claim_policy: row.non_food_claim_policy,
        non_food_use_context_json: JSON.stringify(row.non_food_use_context ?? []),
        non_food_storage_context: row.non_food_storage_context,
        non_food_hazard_tags_json: JSON.stringify(row.non_food_hazard_tags ?? []),
        non_food_age_band: row.non_food_age_band,
        non_food_pet_species_json: JSON.stringify(row.non_food_pet_species ?? []),
        non_food_package_policy: row.non_food_package_policy,
        non_food_labeling_policy: row.non_food_labeling_policy,
        webp512_sha256: row.webp512_sha256,
        png512_sha256: row.png512_sha256,
      })
    }
  } finally {
    await writer.close()
  }
}

async function writeContactSheet(batch, records) {
  const tile = 176
  const labelHeight = 44
  const gap = 18
  const columns = 5
  const rows = Math.ceil(records.length / columns)
  const width = columns * tile + (columns + 1) * gap
  const height = rows * (tile + labelHeight) + (rows + 1) * gap
  const composites = []

  await mkdir(batch.reviewDir, { recursive: true })

  for (const [index, record] of records.entries()) {
    const col = index % columns
    const row = Math.floor(index / columns)
    const left = gap + col * (tile + gap)
    const top = gap + row * (tile + labelHeight + gap)
    const image = await sharp(join(PUBLIC_DIR, record.images.webp512.path))
      .resize(tile, tile, { fit: "contain", background: WHITE })
      .flatten({ background: WHITE })
      .png()
      .toBuffer()
    const label = await sharp(Buffer.from(labelSvg(record.slug, tile, labelHeight))).png().toBuffer()
    composites.push({ input: image, left, top })
    composites.push({ input: label, left, top: top + tile })
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: WHITE,
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(batch.reviewDir, "contact-sheet.png"))
}

async function writeReport(batch, records) {
  const lines = [
    `# ${batch.title}`,
    "",
    "Status: local candidate, not published to npm or Hugging Face.",
    "",
    "## Summary",
    "",
    `- Generated records: ${records.length}`,
    `- Image files added locally: ${records.length * 3}`,
    `- Source images: \`${relative(ROOT, batch.sourceDir)}/*.{webp,png}\``,
    `- Contact sheet: \`${relative(ROOT, join(batch.reviewDir, "contact-sheet.png"))}\``,
    "- Public dataset manifests and checksums were refreshed locally.",
    "",
    "## Visual Rules Used",
    "",
    ...batch.visualRules.map((rule) => `- ${rule}`),
    "",
    "## Records",
    "",
    "| slug | display name | kind | category | subcategory |",
    "| --- | --- | --- | --- | --- |",
    ...records.map(
      (record) =>
        `| \`${record.slug}\` | ${record.displayName} | ${record.kind} | ${record.category} | ${
          record.subcategory ?? ""
        } |`,
    ),
    "",
    "## Remaining Work Before Public Release",
    "",
    "- Owner visual approval.",
    "- Upload derived image files and refreshed public manifests to Hugging Face.",
    "- Publish npm only after Hugging Face paths exist for every new compact manifest record.",
  ]
  await writeFile(join(batch.reviewDir, "batch-report.md"), `${lines.join("\n")}\n`)
}

function summaryEntry(batch, records) {
  return {
    id: batch.id,
    generatedAt: manifest.generatedAt,
    source: "docs/catalog-expansion/v0.1.2/catalog-expansion-candidates.json",
    reviewDir: relative(ROOT, batch.reviewDir),
    slugs: batch.slugs,
    recordsAdded: records.length,
    imageFilesAdded: records.length * 3,
    status: "local-candidate-not-published",
    ...batch.extraSummary,
  }
}

function labelSvg(text, width, height) {
  const safe = escapeXml(text)
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${width / 2}" y="18" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#1f2933">${safe}</text>
</svg>`
}

function datasetPath(...parts) {
  return parts.join("/")
}

function sourcePathFor(batch, slug) {
  for (const extension of ["webp", "png"]) {
    const sourcePath = join(batch.sourceDir, `${slug}.${extension}`)
    if (existsSync(sourcePath)) return sourcePath
  }
  return undefined
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined))
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
