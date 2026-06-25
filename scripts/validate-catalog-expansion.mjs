#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const ROOT = resolve(new URL("..", import.meta.url).pathname)
const PACKET_DIR = join(ROOT, "docs", "catalog-expansion", "v0.1.2")
const CANDIDATES_PATH = join(PACKET_DIR, "catalog-expansion-candidates.json")
const SCHEMA_PATH = join(PACKET_DIR, "catalog-item-manifest.schema.json")
const COMPACT_MANIFEST = join(ROOT, "data", "manifest.compact.json")
const NON_FOOD_CLAIM_POLICY =
  "generic item metadata only; no efficacy, safety, dosage, or medical claims"

const errors = []

const candidates = JSON.parse(await readFile(CANDIDATES_PATH, "utf8"))
const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8"))
const compactManifest = JSON.parse(await readFile(COMPACT_MANIFEST, "utf8"))
const existingSlugs = new Set(Object.keys(compactManifest.recordsBySlug))

if (candidates.schemaVersion !== "0.1.2-candidate") {
  errors.push(`unexpected candidate schemaVersion ${candidates.schemaVersion}`)
}
if (schema.title !== "Ingredient Atlas Catalog Item Manifest") {
  errors.push("catalog schema title changed")
}
if (!Array.isArray(candidates.items)) {
  errors.push("candidates.items is not an array")
} else {
  validateItems(candidates.items)
}

if (errors.length > 0) {
  console.error(`Catalog expansion validation failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      total: candidates.items.length,
      generateImage: candidates.items.filter((item) => item.action === "generate-image").length,
      nonFoodSeed: candidates.items.filter((item) => item.source === "assumed-non-food-seed").length,
      aliasOnly: candidates.items.filter((item) => item.action === "alias-only").length,
      splitBeforeGeneration: candidates.items.filter((item) => item.action === "split-before-generation")
        .length,
    },
    null,
    2,
  ),
)

function validateItems(items) {
  const seen = new Set()
  const bySlug = new Map(items.map((item) => [item.slug, item]))

  for (const item of items) {
    if (seen.has(item.slug)) errors.push(`duplicate slug ${item.slug}`)
    seen.add(item.slug)

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) errors.push(`${item.slug}: invalid slug`)
    if (!["food", "household", "personal", "pet"].includes(item.kind)) {
      errors.push(`${item.slug}: invalid kind ${item.kind}`)
    }
    if (!item.publicNameReviewed) errors.push(`${item.slug}: publicNameReviewed is false`)
    if (!item.privacyReviewed) errors.push(`${item.slug}: privacyReviewed is false`)
    if (/(felix|vlad|test)/i.test(JSON.stringify(item))) {
      errors.push(`${item.slug}: private or test text leaked into candidate data`)
    }
    if (item.kind !== "food" && /nutrition/i.test(item.metadataPolicy ?? "")) {
      errors.push(`${item.slug}: non-food candidate contains nutrition wording`)
    }
    if (item.kind === "food") {
      if (!item.metadata?.food) errors.push(`${item.slug}: food candidate is missing metadata.food`)
      if (item.metadata?.nonFood) errors.push(`${item.slug}: food candidate must not contain metadata.nonFood`)
    } else {
      if (!item.metadata?.nonFood) errors.push(`${item.slug}: non-food candidate is missing metadata.nonFood`)
      if (item.metadata?.food) errors.push(`${item.slug}: non-food candidate must not contain metadata.food`)
      if (item.metadata?.nonFood?.claimPolicy !== NON_FOOD_CLAIM_POLICY) {
        errors.push(`${item.slug}: non-food candidate has unexpected claim policy`)
      }
      if (/nutrition/i.test(JSON.stringify(item.metadata ?? {}))) {
        errors.push(`${item.slug}: non-food metadata contains nutrition wording`)
      }
    }
    if (item.action === "generate-image" && item.visual?.assetStatus !== "queued") {
      errors.push(`${item.slug}: generate-image item is not queued`)
    }
    if (item.action === "generate-image" && !item.visual?.prompt) {
      errors.push(`${item.slug}: generate-image item is missing prompt`)
    }
    if (item.action === "alias-only" && !existingSlugs.has(item.targetSlug)) {
      errors.push(`${item.slug}: alias target ${item.targetSlug} is not in current manifest`)
    }
    for (const target of item.targetSlugs ?? []) {
      if (!existingSlugs.has(target) && !bySlug.has(target)) {
        errors.push(`${item.slug}: split target ${target} is not existing or queued`)
      }
    }
  }

  if (items.filter((item) => item.source === "assumed-non-food-seed").length !== 100) {
    errors.push("expected exactly 100 assumed non-food seed candidates")
  }
  if (items.filter((item) => item.action === "generate-image").length < 150) {
    errors.push("expected at least 150 queued image-generation candidates")
  }
}
