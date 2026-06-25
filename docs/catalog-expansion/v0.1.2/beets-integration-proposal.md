# Beets Catalog Expansion Proposal

Status: v0.1.2 local candidate, not a public release.

## Goal

Expand Ingredient Atlas from food-only ingredient images into a broader shopping catalog that Beets can use for grocery, pantry, household, personal-care, baby, and pet shopping items.

The important design choice is to keep one catalog, but make every record explicit about what kind of item it is.

```json
{
  "kind": "food | household | personal | pet"
}
```

Food items can keep the current food metadata model. Household, personal, and pet items must not inherit nutrition fields, USDA assumptions, dietary flags, or medical claims.

## Inputs Reviewed

The Beets production shopping-history audit found:

- 395 historical shopping rows.
- 365 normalized item types.
- 251 already-covered food item types.
- 14 covered by existing item metadata.
- 46 likely food gaps or alias misses.
- 6 compound entries that need splitting first.
- 22 household or non-food candidates.
- 26 parser/test artifacts that must not become public catalog records.

The v0.1.2 candidate packet adds a curated 100-item non-food seed set on top of the Beets-history findings.

## Candidate Packet

Files:

- `catalog-expansion-candidates.json`
- `catalog-expansion-candidates.csv`
- `catalog-expansion-report.md`
- `catalog-item-manifest.schema.json`

Current generated summary:

- Total candidate rows: 172.
- Image-generation queue: 157.
- Alias-only fixes: 4.
- Split-before-generation items: 5.
- Review-only items: 6.
- Food candidates: 49.
- Household candidates: 63.
- Personal candidates: 48.
- Pet candidates: 12.
- Assumed non-food seed candidates: 100.

## Beets Import Shape

Beets should map catalog records into the current taxonomy-backed image flow like this:

| Catalog field | Beets target | Notes |
| --- | --- | --- |
| `slug` | stable key / alias lookup | Stable public ID. |
| `displayName` | display name | Public-safe generic name. |
| `kind` | new item kind or derived category group | Required before non-food import. |
| `category` | shopping category | Existing Beets categories can continue to work. |
| `subcategory` | optional metadata | Useful for aisle grouping. |
| `aliases` | alias index | Used by shopping item image resolution. |
| `images.webp512.path` | image URL resolution | Same as current Ingredient Atlas flow. |
| `metadata.food` | ingredient metadata | Food only. |
| `metadata.nonFood` | non-food metadata | No nutrition or medical claims. |

The Beets side should not store non-food records in `ingredientTaxonomy` without either renaming the table or adding a clear `kind` discriminator. The safer v0.1.2 approach is to keep `ingredientTaxonomy` for food and create a parallel import/read layer for catalog visuals, then collapse later if the product model proves stable.

## Schema Contract

The proposed manifest schema is intentionally stricter than the current food-only compact manifest:

- Every record must declare `kind`.
- Food records may include `metadata.food` and must not include `metadata.nonFood`.
- Household, personal, and pet records must include `metadata.nonFood` and must not include `metadata.food`.
- Non-food records require the claim policy: `generic item metadata only; no efficacy, safety, dosage, or medical claims`.
- Non-food images must stay generic: no readable brand, dosage, certification, or safety text.

This gives Beets one catalog lookup surface without pretending that toilet paper, shampoo, vitamins, and salmon all share the same metadata model.

## Required Beets Changes Before Import

Already addressed in this branch:

- Category inference should match words and phrases, not substrings. This prevents `shampoo` from matching `ham` and `toilet paper` from matching `oil`.
- Recipe-sync garbage filtering should reject parser fragments such as `to taste`, `juice of`, and names that still contain trailing quantities.

Still recommended before importing v0.1.2:

- Add a `kind` field to shopping item image resolution, or infer `kind` from the catalog record.
- Keep food and non-food metadata separate in Convex.
- Redact personal names and child-specific names before any public artifact.
- Add a manual review step for medicine, supplements, baby items, and pet items.
- Keep medicine and supplement rows as generic shopping objects only. Do not derive dosage, safety, suitability, or health advice from catalog metadata.

## Visual Rules

Food and non-food assets should share the Ingredient Atlas UI style:

- isolated subject
- pure white background
- centered composition
- soft studio light
- no brand names
- no logos
- no readable text
- no people, hands, counters, tables, plates, or lifestyle scenes

Non-food exceptions:

- Generic blank packaging is allowed when the item is hard to understand without packaging.
- Medicine and supplement items should look generic and must not imply dosage, safety, or health outcomes.
- Baby and child items should not include children.
- Pet items should not include animals unless the item is otherwise ambiguous.

## Release Gates

Do not publish v0.1.2 until all of these are true:

1. All alias-only records are applied without increasing image count.
2. Compound records are split into atomic records or rejected.
3. Every `generate-image` record has original, WebP 512, and PNG 512 image files.
4. Every generated image passes background uniformity and visual QA.
5. Non-food records have no food nutrition metadata.
6. Public export contains no private names, prompts, internal storage IDs, or Beets-only deployment details.
7. Beets import can consume food and non-food records without corrupting the current ingredient taxonomy.

## Recommendation

Ship the Beets parser/category cleanup first. Then generate v0.1.2 images in two batches:

1. Food gaps and alias fixes from real Beets history.
2. Non-food seed set, starting with household paper goods, cleaning supplies, personal-care basics, baby basics, and pet basics.

This keeps the public dataset useful for app builders while avoiding the biggest risk: mixing food nutrition semantics into household and personal-care objects.
