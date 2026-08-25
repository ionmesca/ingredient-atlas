#!/usr/bin/env node
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MANIFEST_PATH = join(ROOT, "data", "manifest.compact.json")
const SAMPLE_PATH = join(ROOT, "docs", "pilots", "transparent-cutouts-v0.2.0", "sample.json")
const DATASET_ROOT = join(ROOT, "public-dataset")
const REPORT_PATH = join(DATASET_ROOT, "pilots", "transparent-cutouts-v0.2.0", "download-summary.json")
const BASE_URL = "https://huggingface.co/datasets/ionicam/ingredient-atlas/resolve/main"
const CONCURRENCY = 6

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"))
const sample = JSON.parse(await readFile(SAMPLE_PATH, "utf8"))
const startedAt = new Date()
const wallStart = performance.now()
const results = []

if (sample.slugs.length !== 50 || new Set(sample.slugs).size !== 50) {
  throw new Error("Pilot sample must contain exactly 50 unique slugs")
}

const queue = sample.slugs.map((slug) => {
  const record = manifest.recordsBySlug[slug]
  if (!record) throw new Error(`Missing manifest record for ${slug}`)
  return { slug, image: record.images.original }
})

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

const summary = {
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  wallSeconds: (performance.now() - wallStart) / 1000,
  requested: sample.slugs.length,
  downloaded: results.filter((result) => result.status === "downloaded").length,
  reused: results.filter((result) => result.status === "reused").length,
  bytesDownloaded: results
    .filter((result) => result.status === "downloaded")
    .reduce((sum, result) => sum + result.bytes, 0),
  source: BASE_URL,
  authentication: "none-public-resolver",
  paidApiCalls: 0,
  tokenUsage: 0,
  results: results.sort((a, b) => sample.slugs.indexOf(a.slug) - sample.slugs.indexOf(b.slug)),
}

await mkdir(dirname(REPORT_PATH), { recursive: true })
await writeFile(REPORT_PATH, `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))

async function worker() {
  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) return
    results.push(await fetchImage(item))
  }
}

async function fetchImage({ slug, image }) {
  const destination = join(DATASET_ROOT, image.path)
  const existing = await readFile(destination).catch(() => undefined)
  if (existing && digest(existing) === image.sha256) {
    return { slug, path: image.path, status: "reused", bytes: existing.byteLength, seconds: 0 }
  }

  const started = performance.now()
  const url = `${BASE_URL}/${image.path}`
  let response
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    response = await fetch(url, { redirect: "follow" })
    if (response.ok) break
    if (response.status !== 429 || attempt === 4) {
      throw new Error(`${slug}: download failed with HTTP ${response.status}`)
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1500))
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const actualHash = digest(buffer)
  if (actualHash !== image.sha256) {
    throw new Error(`${slug}: SHA-256 mismatch, expected ${image.sha256}, got ${actualHash}`)
  }
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, buffer)
  return {
    slug,
    path: image.path,
    status: "downloaded",
    bytes: buffer.byteLength,
    seconds: (performance.now() - started) / 1000,
  }
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}
