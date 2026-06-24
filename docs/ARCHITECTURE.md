# Architecture

Ingredient Atlas separates the public dataset from the private generation pipeline.

## Public Artifact

The public artifact should contain:

- Image files.
- Metadata manifest.
- Dataset card.
- License and attribution information.
- Resolver package.
- Validation scripts.

It should not require:

- Beets.
- Convex.
- Gemini.
- API keys.
- The private image generator.

## Source Boundary

The v0 dataset was incubated by Beets and exported into public-safe files. The
private generation pipeline, internal source IDs, raw prompts, and review
artifacts are not required to use Ingredient Atlas.

Once exported, consumers use local files, Hugging Face hosted files, and the
compact manifest.

## Runtime Resolver

The JavaScript package resolver has no runtime dependencies. It reads `data/manifest.compact.json` and exposes:

- `getIngredientImage(input, options)`
- `listIngredientImages()`
- `normalizeIngredientSlug(input)`

This keeps app usage small and independent from the export tooling.

## Export Tooling

The export tooling is development-only. It uses:

- `sharp` to normalize image variants.
- Node.js to write manifests, checksums, and Hugging Face metadata.

## Dataset Layout

```text
dataset/
  README.md
  metadata.jsonl
  metadata.parquet
  manifest.json
  manifest.compact.json
  summary.json
  checksums.sha256
  images/
    original/{category}/{slug}.webp
    webp/512/{category}/{slug}.webp
    png/512/{category}/{slug}.png
```
