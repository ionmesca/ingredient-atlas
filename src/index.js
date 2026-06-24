import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const manifestPath = fileURLToPath(new URL("../data/manifest.compact.json", import.meta.url))

let cachedManifest

export function loadManifest() {
  if (!cachedManifest) {
    cachedManifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  }
  return cachedManifest
}

export function normalizeIngredientSlug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

export function getIngredientImage(value, options = {}) {
  const manifest = loadManifest()
  const slug = normalizeIngredientSlug(value)
  const record = manifest.recordsBySlug[slug] ?? manifest.aliases[slug]
  if (!record) return null

  const variant = options.variant ?? "webp512"
  const image = record.images[variant]
  if (!image) return null

  return {
    slug: record.slug,
    displayName: record.displayName,
    category: record.category,
    path: image.path,
    url: options.baseUrl ? joinUrl(options.baseUrl, image.path) : undefined,
    sha256: image.sha256,
    license: record.license,
    review: record.review,
  }
}

export function listIngredientImages() {
  return Object.values(loadManifest().recordsBySlug)
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`
}
