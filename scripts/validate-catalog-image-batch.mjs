#!/usr/bin/env node
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const require = createRequire(import.meta.url)
const parquet = require("parquetjs-lite")

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC_DIR = join(ROOT, "public-dataset")
const EXPECTED_BASE_RECORDS = 1673
const EXPECTED_BATCHES = [
  {
    id: "food-batch-20",
    summaryKey: "v012Batch20",
    slugs: [
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
    ],
    kind: "food",
    reviewStatus: "v0.1.2-batch-20-generated",
  },
  {
    id: "non-food-pilot-20",
    summaryKey: "v012NonFoodPilot20",
    slugs: [
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
    ],
    kind: undefined,
    reviewStatus: "v0.1.2-non-food-pilot-20-generated",
  },
]
const BATCH_SLUGS = EXPECTED_BATCHES.flatMap((batch) => batch.slugs)
const EXPECTED_RECORDS = EXPECTED_BASE_RECORDS + BATCH_SLUGS.length
const EXPECTED_IMAGE_FILES = EXPECTED_RECORDS * 3
const NON_FOOD_CLAIM_POLICY =
  "generic item metadata only; no efficacy, safety, dosage, or medical claims"
const NON_FOOD_PACKAGE_POLICY = "generic blank packaging only when needed for recognition"
const NON_FOOD_LABELING_POLICY = "no readable brand, dosage, certification, or safety text"

const errors = []
const manifest = await readJson(join(PUBLIC_DIR, "manifest.json"))
const publicCompact = await readJson(join(PUBLIC_DIR, "manifest.compact.json"))
const packageCompact = await readJson(join(ROOT, "data", "manifest.compact.json"))
const summary = await readJson(join(PUBLIC_DIR, "summary.json"))
const metadataRows = (await readFile(join(PUBLIC_DIR, "metadata.jsonl"), "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))

await validate()

if (errors.length > 0) {
  console.error(`Catalog image batch validation failed with ${errors.length} error(s):`)
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`)
  if (errors.length > 100) console.error(`- ... ${errors.length - 100} more`)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      records: manifest.records.length,
      batchRecords: BATCH_SLUGS.length,
      imageFiles: (await listFiles(join(PUBLIC_DIR, "images"))).length,
      checksumRows: summary.counts.checksumRows,
      metadataRows: metadataRows.length,
      packageCompactRecords: Object.keys(packageCompact.recordsBySlug).length,
    },
    null,
    2,
  ),
)

async function validate() {
  if (manifest.name !== "Ingredient Atlas") errors.push("manifest name changed")
  if (manifest.schemaVersion !== "0.1.2-candidate") errors.push(`unexpected schemaVersion ${manifest.schemaVersion}`)
  if (manifest.status !== "public-v0.1.2-candidate") errors.push(`unexpected status ${manifest.status}`)
  if (manifest.publicReleaseApproved !== false) errors.push("candidate manifest must not be public-release approved")
  if (manifest.records.length !== EXPECTED_RECORDS) {
    errors.push(`record count is ${manifest.records.length}, expected ${EXPECTED_RECORDS}`)
  }
  if (summary.counts?.publicRecords !== EXPECTED_RECORDS) {
    errors.push(`summary publicRecords is not ${EXPECTED_RECORDS}`)
  }
  if (summary.counts?.metadataRows !== EXPECTED_RECORDS) {
    errors.push(`summary metadataRows is not ${EXPECTED_RECORDS}`)
  }
  if (summary.counts?.checksumRows !== EXPECTED_IMAGE_FILES) {
    errors.push(`summary checksumRows is not ${EXPECTED_IMAGE_FILES}`)
  }
  if (summary.counts?.imageFiles !== EXPECTED_IMAGE_FILES) {
    errors.push(`summary imageFiles is not ${EXPECTED_IMAGE_FILES}`)
  }

  for (const batch of EXPECTED_BATCHES) {
    const batchSummary = summary[batch.summaryKey]
    if (batchSummary?.recordsAdded !== batch.slugs.length) {
      errors.push(`summary ${batch.summaryKey}.recordsAdded is not ${batch.slugs.length}`)
    }
    if (batchSummary?.imageFilesAdded !== batch.slugs.length * 3) {
      errors.push(`summary ${batch.summaryKey}.imageFilesAdded is not ${batch.slugs.length * 3}`)
    }
    if (batchSummary?.status !== "local-candidate-not-published") {
      errors.push(`summary ${batch.summaryKey}.status is not local-candidate-not-published`)
    }
  }
  if (!Array.isArray(summary.v012ImageBatches) || summary.v012ImageBatches.length !== EXPECTED_BATCHES.length) {
    errors.push("summary v012ImageBatches is missing or incomplete")
  }

  if (JSON.stringify(publicCompact) !== JSON.stringify(packageCompact)) {
    errors.push("package compact manifest does not match public compact manifest")
  }
  if (Object.keys(publicCompact.recordsBySlug).length !== EXPECTED_RECORDS) {
    errors.push(`public compact record count is not ${EXPECTED_RECORDS}`)
  }

  const recordsBySlug = new Map()
  const imagePaths = new Set()
  for (const record of manifest.records) {
    if (recordsBySlug.has(record.slug)) errors.push(`duplicate slug ${record.slug}`)
    recordsBySlug.set(record.slug, record)

    for (const variant of ["original", "webp512", "png512"]) {
      const image = record.images?.[variant]
      if (!image) {
        errors.push(`${record.slug}: missing ${variant}`)
        continue
      }
      imagePaths.add(image.path)
      await verifyImage(record.slug, variant, image)
    }
  }

  for (const batch of EXPECTED_BATCHES) {
    for (const slug of batch.slugs) {
      const record = recordsBySlug.get(slug)
      if (!record) {
        errors.push(`${slug}: missing batch record`)
        continue
      }
      if (batch.kind && record.kind !== batch.kind) errors.push(`${slug}: expected kind ${batch.kind}`)
      if (!batch.kind && !["household", "personal", "pet"].includes(record.kind)) {
        errors.push(`${slug}: expected non-food kind, got ${record.kind}`)
      }
      if (record.license?.status !== "public-v0.1.2-candidate") {
        errors.push(`${slug}: expected candidate license status`)
      }
      if (record.review?.status !== batch.reviewStatus) {
        errors.push(`${slug}: unexpected review status ${record.review?.status}`)
      }
      if (!publicCompact.recordsBySlug[slug]) errors.push(`${slug}: missing compact record`)

      if (record.kind === "food") {
        if (record.metadata?.nutritionSource !== "missing") {
          errors.push(`${slug}: expected missing nutrition source until source review`)
        }
        if (!record.metadata?.nutritionCaution) errors.push(`${slug}: missing nutrition caution`)
      } else {
        if (record.metadata?.claimPolicy !== NON_FOOD_CLAIM_POLICY) {
          errors.push(`${slug}: missing non-food claim policy`)
        }
        if (record.metadata?.packagePolicy !== NON_FOOD_PACKAGE_POLICY) {
          errors.push(`${slug}: missing non-food package policy`)
        }
        if (record.metadata?.labelingPolicy !== NON_FOOD_LABELING_POLICY) {
          errors.push(`${slug}: missing non-food labeling policy`)
        }
        if (/nutrition/i.test(JSON.stringify(record.metadata ?? {}))) {
          errors.push(`${slug}: non-food metadata contains nutrition wording`)
        }
      }
    }
  }

  if (metadataRows.length !== EXPECTED_RECORDS) {
    errors.push(`metadata row count ${metadataRows.length}, expected ${EXPECTED_RECORDS}`)
  }
  const metadataBySlug = new Map(metadataRows.map((row) => [row.slug, row]))
  for (const record of manifest.records) {
    const recordKind = record.kind ?? "food"
    const row = metadataBySlug.get(record.slug)
    if (!row) {
      errors.push(`${record.slug}: missing metadata row`)
      continue
    }
    if ((row.kind ?? "food") !== recordKind) errors.push(`${record.slug}: metadata kind mismatch`)
    if (row.webp512_sha256 !== record.images.webp512.sha256) {
      errors.push(`${record.slug}: metadata webp512 sha mismatch`)
    }
    if (row.png512_sha256 !== record.images.png512.sha256) {
      errors.push(`${record.slug}: metadata png512 sha mismatch`)
    }
    if (recordKind !== "food" && row.non_food_claim_policy !== NON_FOOD_CLAIM_POLICY) {
      errors.push(`${record.slug}: metadata row missing non-food claim policy`)
    }
    if (recordKind !== "food" && row.non_food_package_policy !== NON_FOOD_PACKAGE_POLICY) {
      errors.push(`${record.slug}: metadata row missing non-food package policy`)
    }
    if (recordKind !== "food" && row.non_food_labeling_policy !== NON_FOOD_LABELING_POLICY) {
      errors.push(`${record.slug}: metadata row missing non-food labeling policy`)
    }
  }

  const parquetRows = await countParquetRows(join(PUBLIC_DIR, "metadata.parquet"))
  if (parquetRows !== EXPECTED_RECORDS) {
    errors.push(`metadata.parquet row count ${parquetRows}, expected ${EXPECTED_RECORDS}`)
  }

  const checksumRows = (await readFile(join(PUBLIC_DIR, "checksums.sha256"), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
  if (checksumRows.length !== EXPECTED_IMAGE_FILES) {
    errors.push(`checksum row count ${checksumRows.length}, expected ${EXPECTED_IMAGE_FILES}`)
  }
  const expectedChecksumRows = manifest.records
    .flatMap((record) => Object.values(record.images).map((image) => `${image.sha256}  ${image.path}`))
    .sort()
  if (checksumRows.join("\n") !== expectedChecksumRows.join("\n")) {
    errors.push("checksums.sha256 does not match manifest image hashes")
  }

  const files = await listFiles(join(PUBLIC_DIR, "images"))
  if (files.length !== EXPECTED_IMAGE_FILES) errors.push(`image file count ${files.length}, expected ${EXPECTED_IMAGE_FILES}`)
  for (const file of files) {
    const rel = relative(PUBLIC_DIR, file).split("\\").join("/")
    if (!imagePaths.has(rel)) errors.push(`unreferenced image file ${rel}`)
  }
}

async function verifyImage(slug, variant, image) {
  const absolute = join(PUBLIC_DIR, image.path)
  if (!existsSync(absolute)) {
    errors.push(`${slug}: missing ${variant} file ${image.path}`)
    return
  }
  const buffer = await readFile(absolute)
  const hash = createHash("sha256").update(buffer).digest("hex")
  if (hash !== image.sha256) errors.push(`${slug}: ${variant} sha256 mismatch`)
  if (buffer.length !== image.bytes) errors.push(`${slug}: ${variant} byte count mismatch`)
  const metadata = await sharp(buffer).metadata()
  if (metadata.width !== image.width || metadata.height !== image.height) {
    errors.push(`${slug}: ${variant} dimensions mismatch`)
  }
  if (variant !== "original" && (metadata.width > 512 || metadata.height > 512)) {
    errors.push(`${slug}: ${variant} exceeds 512px`)
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

async function countParquetRows(path) {
  const reader = await parquet.ParquetReader.openFile(path)
  try {
    const cursor = reader.getCursor()
    let count = 0
    while (await cursor.next()) count += 1
    return count
  } finally {
    await reader.close()
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute)))
    } else {
      files.push(absolute)
    }
  }
  return files
}
