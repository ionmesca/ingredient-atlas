#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC_DIR = join(ROOT, "public-dataset")
const ASSETS_DIR = join(ROOT, "launch", "assets")
const CUTOUTS_DIR = join(ASSETS_DIR, "readme-cutouts")

const manifest = JSON.parse(
  await readFile(join(PUBLIC_DIR, "manifest.compact.json"), "utf8"),
)
const summary = JSON.parse(await readFile(join(PUBLIC_DIR, "summary.json"), "utf8"))
const bySlug = new Map(
  Object.entries(manifest.recordsBySlug).map(([slug, record]) => [slug, { slug, ...record }]),
)
const aliasCount = Object.keys(manifest.aliases).length

const itemSlugs = [
  "starfruit",
  "apricot",
  "avocado",
  "banana",
  "bartlett-pear",
  "basil",
  "beet",
  "blackberry",
  "blueberry",
  "broccoli-crown",
  "carrot",
  "cauliflower",
  "cherry-tomato",
  "clementine",
  "corn",
  "cucumber",
  "egg",
  "eggplant",
  "fig",
  "garlic",
  "green-bell-pepper",
  "jalapeno",
  "japanese-persimmon",
  "lemon",
  "lime",
  "mango",
  "mushroom",
  "onion",
  "pineapple",
  "pomegranate",
  "potato",
  "pumpkin",
  "salmon",
  "strawberry",
  "watermelon",
  "zucchini",
]
const items = itemSlugs.map(record)
const heroTextSlots = new Map([
  [3, ["Ingredient", "Atlas"]],
  [12, ["Open", "Dataset"]],
  [15, [summary.counts.publicRecords.toLocaleString("en-US"), "Records"]],
  [27, [aliasCount.toLocaleString("en-US"), "Aliases"]],
  [30, ["CC0", "Images"]],
  [40, ["18", "Categories"]],
])

await createHero()
await createCatalogSheet()

console.log(
  JSON.stringify(
    {
      hero: "launch/assets/readme-hero.png",
      sheet: "launch/assets/ingredient-atlas-contact-sheet.png",
      cutouts: "launch/assets/readme-cutouts/",
      recordsShown: items.length,
    },
    null,
    2,
  ),
)

async function createHero() {
  const width = 1600
  const height = 1000
  const columns = 7
  const slots = columns * 6
  const itemSlots = Array.from({ length: slots }, (_, index) => index).filter(
    (index) => !heroTextSlots.has(index),
  )
  if (itemSlots.length !== items.length) {
    throw new Error(`Hero has ${itemSlots.length} item slots for ${items.length} items`)
  }

  const composites = [{ input: heroCanvasSvg(width, height), left: 0, top: 0 }]
  for (let index = 0; index < items.length; index += 1) {
    const center = heroSlotCenter(itemSlots[index])
    const size = 112 + ((index * 17) % 34)
    const image = await fitCutout(items[index].slug, size)
    composites.push({
      input: image.buffer,
      left: Math.round(center.x - image.width / 2),
      top: Math.round(center.y - image.height / 2),
    })
  }

  await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(ASSETS_DIR, "readme-hero.png"))
}

function heroCanvasSvg(width, height) {
  const words = [...heroTextSlots.entries()]
    .map(([slot, [small, large]]) => {
      const { x, y } = heroSlotCenter(slot)
      return `
        <text x="${x}" y="${y - 7}" text-anchor="middle" class="word-small">${escapeXml(small)}</text>
        <text x="${x}" y="${y + 23}" text-anchor="middle" class="word-large">${escapeXml(large)}</text>
      `
    })
    .join("")

  return svgBuffer(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="#d7d8d5" fill-opacity="0.72"/>
      </pattern>
      <clipPath id="canvas-clip">
        <rect x="12" y="12" width="1576" height="976" rx="42"/>
      </clipPath>
    </defs>
    <style>
      .word-small{font:16px Arial,sans-serif;fill:#777a76}
      .word-large{font:700 25px Arial,sans-serif;fill:#121412}
    </style>
    <rect width="100%" height="100%" fill="#ffffff"/>
    <rect x="12" y="12" width="1576" height="976" rx="42" fill="#f7f7f6"/>
    <rect width="100%" height="100%" fill="url(#dots)" clip-path="url(#canvas-clip)"/>
    ${words}
  </svg>`)
}

function heroSlotCenter(slot) {
  const column = slot % 7
  const row = Math.floor(slot / 7)
  return {
    x: 125 + column * 225,
    y: 100 + row * 160,
  }
}

async function createCatalogSheet() {
  const width = 1600
  const height = 1100
  const columns = 9
  const startX = 100
  const startY = 255
  const gapX = 175
  const gapY = 220
  const composites = [{ input: sheetCanvasSvg(width, height), left: 0, top: 0 }]

  for (let index = 0; index < items.length; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const centerX = startX + column * gapX
    const centerY = startY + row * gapY
    const image = await fitCutout(items[index].slug, 122)
    composites.push({
      input: image.buffer,
      left: Math.round(centerX - image.width / 2),
      top: Math.round(centerY - image.height / 2),
    })
  }

  await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(ASSETS_DIR, "ingredient-atlas-contact-sheet.png"))
}

function sheetCanvasSvg(width, height) {
  const labels = items
    .map((item, index) => {
      const column = index % 9
      const row = Math.floor(index / 9)
      const x = 100 + column * 175
      const y = 255 + row * 220 + 91
      return `<text x="${x}" y="${y}" text-anchor="middle" class="item">${escapeXml(item.displayName)}</text>`
    })
    .join("")

  return svgBuffer(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="#d7d8d5" fill-opacity="0.72"/>
      </pattern>
      <clipPath id="canvas-clip">
        <rect x="12" y="12" width="1576" height="1076" rx="42"/>
      </clipPath>
    </defs>
    <style>
      .eyebrow{font:700 14px Arial,sans-serif;letter-spacing:2.1px;fill:#777a76}
      .title{font:700 48px Arial,sans-serif;fill:#121412}
      .sub{font:18px Arial,sans-serif;fill:#666a65}
      .item{font:700 13px Arial,sans-serif;fill:#282b28}
    </style>
    <rect width="100%" height="100%" fill="#ffffff"/>
    <rect x="12" y="12" width="1576" height="1076" rx="42" fill="#f7f7f6"/>
    <rect width="100%" height="100%" fill="url(#dots)" clip-path="url(#canvas-clip)"/>
    <text x="72" y="78" class="eyebrow">OPEN DATASET</text>
    <text x="68" y="137" class="title">Ingredient Atlas</text>
    <text x="70" y="173" class="sub">36 of ${summary.counts.publicRecords.toLocaleString("en-US")} records · ${aliasCount.toLocaleString("en-US")} aliases · 18 categories</text>
    ${labels}
  </svg>`)
}

function record(slug) {
  const value = bySlug.get(slug)
  if (!value) {
    throw new Error(`Missing catalog record: ${slug}`)
  }
  return value
}

async function fitCutout(slug, size) {
  const buffer = await sharp(join(CUTOUTS_DIR, `${slug}.webp`))
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
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
