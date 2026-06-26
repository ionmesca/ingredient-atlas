# v0.1.2 Readiness Review

Status: approved for the v0.1.2 release sequence.

## What Is Ready

- The Beets shopping-history audit has been converted into a public-safe candidate packet.
- The packet separates true food gaps, alias-only fixes, compound split items, review-only rows, and non-food catalog candidates.
- The schema now requires every record to declare `kind`: `food`, `household`, `personal`, or `pet`.
- The schema keeps food metadata and non-food metadata mutually exclusive.
- Non-food metadata requires a claim policy that avoids nutrition, medical, dosage, safety, or efficacy claims.
- The package API has a future-safe catalog layer while preserving the ingredient helpers.
- The first 20 low-risk food images have been generated as a local v0.1.2 candidate batch.
- Five countable food images were regenerated with smaller, more recipe-app-realistic quantities.
- A 20-item non-food pilot batch has been generated across household, personal-care, and pet basics.
- All 157 queued v0.1.2 image-generation candidates now have local review sources and candidate manifest records.

## Visual Review

The current v0.1.1 food catalog already has the unified white-background style. For v0.1.2, every queued image should be checked against the same rules before any public release:

- Pure white or near-white background.
- Single centered subject.
- No brand names, logos, readable text, watermarks, hands, people, tables, plates, or lifestyle scenes.
- Generic blank packaging only when the item is hard to recognize without packaging.
- No medical, dosage, certification, or safety text on medicine, supplement, baby, personal-care, or pet items.
- Food should still read as food, not as a packaged product, unless the item itself is normally packaged.

## Release Notes

- Owner visual review is complete for the generated v0.1.2 image batches.
- Alias-only fixes still need to be applied to the production manifest when v0.1.2 is assembled.
- Split-before-generation rows still need to become atomic records or be rejected.
- The final v0.1.2 public export still needs upload verification on Hugging Face before npm can safely publish references to the new image paths.
- Beets should import all catalog kinds through a catalog-aware path rather than treating household, personal, and pet records as food taxonomy rows.

## Recommended Order

1. Merge the Beets parser/category cleanup.
2. Review the remaining alias-only and split-before-generation cleanup as a follow-up patch.
3. Upload the refreshed local public export to Hugging Face and verify paths, counts, and checksums remotely.
4. Publish the public v0.1.2 npm, Hugging Face, and GitHub release.
5. Update Beets to consume every catalog kind.
