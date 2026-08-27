#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC_DIR = join(ROOT, "public-dataset")
const ASSETS_DIR = join(ROOT, "launch", "assets")

const manifest = JSON.parse(
  await readFile(join(PUBLIC_DIR, "manifest.compact.json"), "utf8"),
)
const summary = JSON.parse(await readFile(join(PUBLIC_DIR, "summary.json"), "utf8"))
const bySlug = new Map(
  Object.entries(manifest.recordsBySlug).map(([slug, record]) => [slug, { slug, ...record }]),
)

const heroRecords = records([
  "garlic",
  "lemon-juice",
  "avocado",
  "salmon",
  "paper-towels",
  "hand-sanitizer",
  "dog-food",
  "batteries",
])

const sheetSections = [
  {
    title: "Food",
    slugs: ["garlic", "lemon-juice", "ginger", "avocado", "salmon", "chickpeas"],
  },
  {
    title: "Household",
    slugs: [
      "paper-towels",
      "dish-soap",
      "laundry-detergent",
      "batteries",
      "aluminum-foil",
      "trash-bags",
    ],
  },
  {
    title: "Personal care",
    slugs: [
      "hand-sanitizer",
      "toothbrushes",
      "sunscreen",
      "shampoo",
      "body-wash",
      "conditioner",
    ],
  },
  {
    title: "Pets",
    slugs: [
      "dog-food",
      "cat-food",
      "cat-litter",
      "dog-treats",
      "pet-shampoo",
      "pet-waste-bags",
    ],
  },
].map((section) => ({ ...section, records: records(section.slugs) }))

await createHero()
await createCatalogSheet()

console.log(
  JSON.stringify(
    {
      hero: "launch/assets/readme-hero.png",
      sheet: "launch/assets/ingredient-atlas-contact-sheet.png",
      heroRecordsShown: heroRecords.length,
      sheetRecordsShown: sheetSections.reduce(
        (count, section) => count + section.records.length,
        0,
      ),
    },
    null,
    2,
  ),
)

async function createHero() {
  const width = 1600
  const height = 1000
  const tileWidth = 198
  const gridX = 365
  const gridY = 380
  const gapX = 218
  const gapY = 188
  const composites = [{ input: heroSvg(width, height), left: 0, top: 0 }]

  for (let index = 0; index < heroRecords.length; index += 1) {
    const col = index % 4
    const row = Math.floor(index / 4)
    const tileX = gridX + col * gapX
    const tileY = gridY + row * gapY
    const image = await fitImage(imagePath(heroRecords[index]), 142, 112)
    composites.push({
      input: image.buffer,
      left: tileX + Math.floor((tileWidth - image.width) / 2),
      top: tileY + 12 + Math.floor((116 - image.height) / 2),
    })
  }

  await sharp({ create: { width, height, channels: 3, background: "#0c0a09" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(ASSETS_DIR, "readme-hero.png"))
}

function heroSvg(width, height) {
  const tiles = heroRecords
    .map((record, index) => {
      const col = index % 4
      const row = Math.floor(index / 4)
      const x = 365 + col * 218
      const y = 380 + row * 188
      return `
        <rect x="${x}" y="${y}" width="198" height="172" rx="18" fill="#ffffff" stroke="#dedbd2"/>
        <text x="${x + 99}" y="${y + 151}" text-anchor="middle" class="item">${escapeXml(record.displayName)}</text>
      `
    })
    .join("")

  return svgBuffer(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="canvas" cx="50%" cy="40%" r="72%">
        <stop offset="0%" stop-color="#1c1917"/>
        <stop offset="56%" stop-color="#131110"/>
        <stop offset="100%" stop-color="#0c0a09"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000000" flood-opacity="0.48"/>
      </filter>
    </defs>
    <style>
      .eyebrow{font:700 14px Arial,sans-serif;letter-spacing:2.2px;fill:#456d4a}
      .title{font:700 54px Arial,sans-serif;fill:#162019}
      .sub{font:20px Arial,sans-serif;fill:#536158}
      .stat{font:700 16px Arial,sans-serif;fill:#26372b}
      .item{font:700 14px Arial,sans-serif;fill:#263229}
    </style>
    <rect width="100%" height="100%" fill="url(#canvas)"/>
    <rect x="310" y="200" width="980" height="600" rx="28" fill="#f3f1ea" filter="url(#shadow)"/>
    <text x="365" y="265" class="eyebrow">OPEN CATALOG DATASET</text>
    <text x="362" y="325" class="title">Ingredient Atlas</text>
    <text x="365" y="355" class="sub">A clean name and image for every shopping-list item.</text>
    <rect x="1032" y="267" width="203" height="42" rx="21" fill="#dde9d8"/>
    <text x="1133" y="294" text-anchor="middle" class="stat">${summary.counts.publicRecords.toLocaleString("en-US")} records</text>
    ${tiles}
  </svg>`)
}

async function createCatalogSheet() {
  const width = 1600
  const height = 1000
  const itemStartX = 430
  const firstRowY = 245
  const rowGap = 158
  const tileWidth = 142
  const gapX = 157
  const composites = [{ input: sheetSvg(width, height), left: 0, top: 0 }]

  for (let sectionIndex = 0; sectionIndex < sheetSections.length; sectionIndex += 1) {
    const section = sheetSections[sectionIndex]
    const tileY = firstRowY + sectionIndex * rowGap
    for (let index = 0; index < section.records.length; index += 1) {
      const tileX = itemStartX + index * gapX
      const image = await fitImage(imagePath(section.records[index]), 105, 82)
      composites.push({
        input: image.buffer,
        left: tileX + Math.floor((tileWidth - image.width) / 2),
        top: tileY + 8 + Math.floor((86 - image.height) / 2),
      })
    }
  }

  await sharp({ create: { width, height, channels: 3, background: "#0c0a09" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(ASSETS_DIR, "ingredient-atlas-contact-sheet.png"))
}

function sheetSvg(width, height) {
  const rows = sheetSections
    .map((section, sectionIndex) => {
      const y = 245 + sectionIndex * 158
      const items = section.records
        .map((record, index) => {
          const x = 430 + index * 157
          return `
            <rect x="${x}" y="${y}" width="142" height="128" rx="15" fill="#ffffff" stroke="#dedbd2"/>
            <text x="${x + 71}" y="${y + 112}" text-anchor="middle" class="item">${escapeXml(record.displayName)}</text>
          `
        })
        .join("")
      return `
        <text x="200" y="${y + 48}" class="section">${escapeXml(section.title)}</text>
        <text x="200" y="${y + 75}" class="count">6 records</text>
        ${items}
      `
    })
    .join("")

  return svgBuffer(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="canvas" cx="50%" cy="40%" r="72%">
        <stop offset="0%" stop-color="#1c1917"/>
        <stop offset="56%" stop-color="#131110"/>
        <stop offset="100%" stop-color="#0c0a09"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000000" flood-opacity="0.48"/>
      </filter>
    </defs>
    <style>
      .title{font:700 46px Arial,sans-serif;fill:#162019}
      .sub{font:18px Arial,sans-serif;fill:#5a665e}
      .section{font:700 21px Arial,sans-serif;fill:#263229}
      .count{font:15px Arial,sans-serif;fill:#788078}
      .item{font:700 12px Arial,sans-serif;fill:#263229}
    </style>
    <rect width="100%" height="100%" fill="url(#canvas)"/>
    <rect x="140" y="90" width="1320" height="820" rx="28" fill="#f3f1ea" filter="url(#shadow)"/>
    <text x="200" y="165" class="title">The whole shopping list</text>
    <text x="202" y="201" class="sub">24 catalog records shown here. ${summary.counts.publicRecords.toLocaleString("en-US")} records across 18 categories.</text>
    ${rows}
  </svg>`)
}

function records(slugs) {
  return slugs.map((slug) => {
    const record = bySlug.get(slug)
    if (!record) {
      throw new Error(`Missing catalog record: ${slug}`)
    }
    return record
  })
}

function imagePath(record) {
  return join(PUBLIC_DIR, record.images.webp512.path)
}

async function fitImage(path, width, height) {
  const buffer = await sharp(path)
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toBuffer()
  const metadata = await sharp(buffer).metadata()
  return { buffer, width: metadata.width, height: metadata.height }
}

function svgBuffer(svg) {
  return Buffer.from(svg)
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
