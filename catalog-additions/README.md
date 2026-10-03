# Reviewed catalog additions

`manifest.json` is the durable public-safe source for independently reviewed new ingredients. It includes food state, source snapshots, complete or explicitly unknown nutrition, separate branded portion evidence, review hashes, and exact white/transparent image variants. Approved image bytes live in `assets/` and are copied unchanged into full exports.

Run `node src/catalog-additions.mjs` to inspect an append. Add `--write` to update existing local full/compact manifests, JSONL, Parquet, checksums and counts. Install a separately reviewed source packet using `--stage <directory>`; it defaults to inspection until `--write` is supplied. Existing slugs, aliases and image bytes are never overwritten. Proven incorrect aliases require a separate reviewed correction.

Successful repeat execution verifies the exact added rows and bytes. An interrupted transaction leaves a private pending receipt and requires inspection before retry. Operational receipts and locks are ignored by Git. No production credentials or application writes are used by this adapter.

The generic live-source dataset builders can recreate images and are not the maintenance path for this packet. Keep this canonical source when preparing future exports and use the guarded append adapter afterward; never infer that a general rebuild preserves reviewed images or all existing catalog expansion rows.
