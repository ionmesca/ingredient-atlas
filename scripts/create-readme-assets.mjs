#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC_DIR = join(ROOT, "public-dataset")
const ASSETS_DIR = join(ROOT, "launch", "assets")
const BACKGROUND_PATH = join(ASSETS_DIR, "readme-hero-background.png")

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
    tone: "#dcebd4",
    slugs: ["garlic", "lemon-juice", "ginger", "avocado", "salmon", "chickpeas"],
  },
  {
    title: "Household",
    tone: "#dce9ef",
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
    tone: "#e9deed",
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
    tone: "#f1dfd4",
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
      background: "launch/assets/readme-hero-background.png",
      recordsShown: 32,
    },
    null,
    2,
  ),
)

async function createHero() {
  const width = 1600
  const height = 760
  const cardWidth = 185
  const cardHeight = 220
  const startX = 780
  const startY = 125
  const gapX = 200
  const gapY = 245

  const background = await sharp(BACKGROUND_PATH)
    .resize(width, height, { fit: "cover" })
    .modulate({ brightness: 1.03, saturation: 0.78 })
    .png()
    .toBuffer()
  const composites = [{ input: heroSvg(width, height, heroRecords), left: 0, top: 0 }]

  for (let index = 0; index < heroRecords.length; index += 1) {
    const col = index % 4
    const row = Math.floor(index / 4)
    const cardX = startX + col * gapX
    const cardY = startY + row * gapY
    const image = await fitImage(imagePath(heroRecords[index]), 145, 138)
    composites.push({
      input: image.buffer,
      left: cardX + Math.floor((cardWidth - image.width) / 2),
      top: cardY + 18 + Math.floor((142 - image.height) / 2),
    })
  }

  await sharp(background)
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(ASSETS_DIR, "readme-hero.png"))
}

function heroSvg(width, height, shownRecords) {
  const cards = shownRecords
    .map((record, index) => {
      const col = index % 4
      const row = Math.floor(index / 4)
      const x = 780 + col * 200
      const y = 125 + row * 245
      const kind = record.kind || "food"
      const kindLabel = kind === "personal" ? "personal care" : kind
      const tone = {
        food: "#dcebd4",
        household: "#dce9ef",
        personal: "#e9deed",
        pet: "#f1dfd4",
      }[kind]
      return `
        <rect x="${x}" y="${y}" width="185" height="220" rx="22" fill="#fffdf8" fill-opacity="0.96" stroke="#d8d4c9"/>
        <rect x="${x + 14}" y="${y + 164}" width="${Math.max(58, kindLabel.length * 7.4 + 20)}" height="22" rx="11" fill="${tone}"/>
        <text x="${x + 24}" y="${y + 179}" class="kind">${escapeXml(kindLabel)}</text>
        <text x="${x + 92.5}" y="${y + 205}" text-anchor="middle" class="item">${escapeXml(record.displayName)}</text>
      `
    })
    .join("")

  return svgBuffer(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .eyebrow{font:700 16px Arial,sans-serif;letter-spacing:2.4px;fill:#47724c}
      .title{font:700 78px Arial,sans-serif;fill:#142018}
      .lead{font:30px Arial,sans-serif;fill:#34473a}
      .body{font:21px Arial,sans-serif;fill:#536158}
      .stat{font:700 18px Arial,sans-serif;fill:#23352a}
      .kind{font:700 11px Arial,sans-serif;letter-spacing:.6px;fill:#435248}
      .item{font:700 15px Arial,sans-serif;fill:#25342a}
      .footer{font:16px Arial,sans-serif;fill:#5a665e}
    </style>
    <rect x="44" y="44" width="1512" height="672" rx="34" fill="#fffdf8" fill-opacity="0.52" stroke="#d8d1c2" stroke-opacity="0.72"/>
    <text x="88" y="120" class="eyebrow">OPEN CATALOG DATASET</text>
    <text x="84" y="215" class="title">Ingredient Atlas</text>
    <text x="88" y="280" class="lead">A picture and a clean name for</text>
    <text x="88" y="320" class="lead">every shopping-list item.</text>
    <text x="88" y="390" class="body">Food, household, personal care, and pets.</text>
    <rect x="88" y="442" width="186" height="48" rx="24" fill="#fffdf8" stroke="#cfc9bb"/>
    <rect x="286" y="442" width="188" height="48" rx="24" fill="#fffdf8" stroke="#cfc9bb"/>
    <rect x="486" y="442" width="190" height="48" rx="24" fill="#fffdf8" stroke="#cfc9bb"/>
    <text x="181" y="473" text-anchor="middle" class="stat">${summary.counts.publicRecords.toLocaleString("en-US")} records</text>
    <text x="380" y="473" text-anchor="middle" class="stat">8,735 aliases</text>
    <text x="581" y="473" text-anchor="middle" class="stat">CC0 images</text>
    <text x="88" y="578" class="footer">Stable slugs. Three image files per record. No account or API key.</text>
    <text x="88" y="612" class="footer">Built and used by Buna, published for anyone building shopping software.</text>
    ${cards}
  </svg>`)
}

async function createCatalogSheet() {
  const width = 1600
  const height = 1390
  const cardWidth = 230
  const cardHeight = 220
  const left = 60
  const startY = 180
  const sectionHeight = 295
  const gapX = 255

  const background = await sharp(BACKGROUND_PATH)
    .resize(width, height, { fit: "cover" })
    .modulate({ brightness: 1.08, saturation: 0.5 })
    .png()
    .toBuffer()
  const composites = [{ input: sheetSvg(width, height), left: 0, top: 0 }]

  for (let sectionIndex = 0; sectionIndex < sheetSections.length; sectionIndex += 1) {
    const section = sheetSections[sectionIndex]
    const cardY = startY + sectionIndex * sectionHeight + 48
    for (let index = 0; index < section.records.length; index += 1) {
      const cardX = left + index * gapX
      const image = await fitImage(imagePath(section.records[index]), 175, 145)
      composites.push({
        input: image.buffer,
        left: cardX + Math.floor((cardWidth - image.width) / 2),
        top: cardY + 14 + Math.floor((150 - image.height) / 2),
      })
    }
  }

  await sharp(background)
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(ASSETS_DIR, "ingredient-atlas-contact-sheet.png"))
}

function sheetSvg(width, height) {
  const sections = sheetSections
    .map((section, sectionIndex) => {
      const sectionY = 180 + sectionIndex * 295
      const cards = section.records
        .map((record, index) => {
          const x = 60 + index * 255
          const y = sectionY + 48
          return `
            <rect x="${x}" y="${y}" width="230" height="220" rx="20" fill="#fffdf9" fill-opacity="0.97" stroke="#d9d5ca"/>
            <text x="${x + 115}" y="${y + 194}" text-anchor="middle" class="item">${escapeXml(record.displayName)}</text>
          `
        })
        .join("")
      return `
        <rect x="60" y="${sectionY}" width="${Math.max(86, section.title.length * 10 + 34)}" height="34" rx="17" fill="${section.tone}"/>
        <text x="77" y="${sectionY + 23}" class="section">${escapeXml(section.title)}</text>
        ${cards}
      `
    })
    .join("")

  return svgBuffer(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title{font:700 54px Arial,sans-serif;fill:#142018}
      .sub{font:22px Arial,sans-serif;fill:#536158}
      .section{font:700 15px Arial,sans-serif;letter-spacing:.7px;fill:#34443a}
      .item{font:700 16px Arial,sans-serif;fill:#25342a}
    </style>
    <rect width="100%" height="100%" fill="#faf8f2" fill-opacity="0.86"/>
    <text x="60" y="72" class="title">One atlas, the whole shopping list</text>
    <text x="62" y="112" class="sub">24 real catalog records shown here. ${summary.counts.publicRecords.toLocaleString("en-US")} records across 18 categories in the dataset.</text>
    ${sections}
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
