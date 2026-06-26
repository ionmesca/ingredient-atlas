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
const BATCH_SLUGS = [
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
  if (manifest.records.length !== 1693) errors.push(`record count is ${manifest.records.length}, expected 1693`)
  if (summary.counts?.publicRecords !== 1693) errors.push("summary publicRecords is not 1693")
  if (summary.counts?.metadataRows !== 1693) errors.push("summary metadataRows is not 1693")
  if (summary.counts?.checksumRows !== 5079) errors.push("summary checksumRows is not 5079")
  if (summary.counts?.imageFiles !== 5079) errors.push("summary imageFiles is not 5079")
  if (summary.v012Batch20?.recordsAdded !== 20) errors.push("summary v012Batch20.recordsAdded is not 20")

  if (JSON.stringify(publicCompact) !== JSON.stringify(packageCompact)) {
    errors.push("package compact manifest does not match public compact manifest")
  }
  if (Object.keys(publicCompact.recordsBySlug).length !== 1693) {
    errors.push("public compact record count is not 1693")
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

  for (const slug of BATCH_SLUGS) {
    const record = recordsBySlug.get(slug)
    if (!record) {
      errors.push(`${slug}: missing batch record`)
      continue
    }
    if (record.kind !== "food") errors.push(`${slug}: expected kind food`)
    if (record.license?.status !== "public-v0.1.2-candidate") {
      errors.push(`${slug}: expected candidate license status`)
    }
    if (record.metadata?.nutritionSource !== "missing") {
      errors.push(`${slug}: expected missing nutrition source until source review`)
    }
    if (!record.metadata?.nutritionCaution) errors.push(`${slug}: missing nutrition caution`)
    if (record.review?.status !== "v0.1.2-batch-20-generated") {
      errors.push(`${slug}: unexpected review status ${record.review?.status}`)
    }
    if (!publicCompact.recordsBySlug[slug]) errors.push(`${slug}: missing compact record`)
  }

  if (metadataRows.length !== 1693) errors.push(`metadata row count ${metadataRows.length}, expected 1693`)
  const metadataBySlug = new Map(metadataRows.map((row) => [row.slug, row]))
  for (const record of manifest.records) {
    const row = metadataBySlug.get(record.slug)
    if (!row) {
      errors.push(`${record.slug}: missing metadata row`)
      continue
    }
    if (row.webp512_sha256 !== record.images.webp512.sha256) {
      errors.push(`${record.slug}: metadata webp512 sha mismatch`)
    }
    if (row.png512_sha256 !== record.images.png512.sha256) {
      errors.push(`${record.slug}: metadata png512 sha mismatch`)
    }
  }

  const parquetRows = await countParquetRows(join(PUBLIC_DIR, "metadata.parquet"))
  if (parquetRows !== 1693) errors.push(`metadata.parquet row count ${parquetRows}, expected 1693`)

  const checksumRows = (await readFile(join(PUBLIC_DIR, "checksums.sha256"), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
  if (checksumRows.length !== 5079) errors.push(`checksum row count ${checksumRows.length}, expected 5079`)
  const expectedChecksumRows = manifest.records
    .flatMap((record) => Object.values(record.images).map((image) => `${image.sha256}  ${image.path}`))
    .sort()
  if (checksumRows.join("\n") !== expectedChecksumRows.join("\n")) {
    errors.push("checksums.sha256 does not match manifest image hashes")
  }

  const files = await listFiles(join(PUBLIC_DIR, "images"))
  if (files.length !== 5079) errors.push(`image file count ${files.length}, expected 5079`)
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
