# v0.1.2 Readiness Review

Status: local candidate ready for code review. Not a public release.

## What Is Ready

- The Beets shopping-history audit has been converted into a public-safe candidate packet.
- The packet separates true food gaps, alias-only fixes, compound split items, review-only rows, and non-food catalog candidates.
- The schema now requires every record to declare `kind`: `food`, `household`, `personal`, or `pet`.
- The schema keeps food metadata and non-food metadata mutually exclusive.
- Non-food metadata requires a claim policy that avoids nutrition, medical, dosage, safety, or efficacy claims.
- The package API has a future-safe catalog layer while preserving the ingredient helpers.
- The first 20 low-risk food images have been generated as a local v0.1.2 candidate batch.

## Visual Review

The current v0.1.1 food catalog already has the unified white-background style. For v0.1.2, every queued image should be checked against the same rules before any public release:

- Pure white or near-white background.
- Single centered subject.
- No brand names, logos, readable text, watermarks, hands, people, tables, plates, or lifestyle scenes.
- Generic blank packaging only when the item is hard to recognize without packaging.
- No medical, dosage, certification, or safety text on medicine, supplement, baby, personal-care, or pet items.
- Food should still read as food, not as a packaged product, unless the item itself is normally packaged.

## Not Ready For Public Release Yet

- The original 157 queued catalog images are partly started: 20 are generated in `reviews/v0.1.2-batch-20`, and 137 still need to be generated or explicitly deferred.
- Alias-only fixes still need to be applied to the production manifest when v0.1.2 is assembled.
- Split-before-generation rows still need to become atomic records or be rejected.
- The final v0.1.2 export still needs image checksums, manifests, package compact manifest updates, and visual QA artifacts.
- Beets should import non-food records through a catalog-aware path rather than mixing them blindly into the food taxonomy.
- The 20 generated records must not be published to npm until the matching image files and refreshed public manifests have also been uploaded to Hugging Face.

## Recommended Order

1. Merge the Beets parser/category cleanup.
2. Review the v0.1.2 candidate packet and adjust any names or categories.
3. Generate images in batches: food gaps first, then household and personal-care basics, then baby and pet items.
4. Run background uniformity, visual QA, manifest, checksum, smoke, pack, and audit checks.
5. Only then prepare a public v0.1.2 release.
