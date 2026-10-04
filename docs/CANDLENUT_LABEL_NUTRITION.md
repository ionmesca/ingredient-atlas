# Reviewed candlenut label supplement

This is a food-specific eight-field supplement for an explicitly missing candlenut profile. It uses the Lucullus 47492 manufacturer specification as a declared branded stand-in, not a generic raw/cooked laboratory profile. EU label carbohydrate, label-rounded sugar zero and sodium derived from declared salt remain explicit. Per-kernel mass is unresolved; density, allergy flags and recipes are outside this operation.

`src/candlenut-label.mjs` requires an independently accepted public field-evidence projection and a separate independently accepted operation bound to the exact private/public Atlas row and derivative schema. `captureCandlenutLabelIntent` captures only missing profiles. Its output is pending and cannot be applied until a different reviewer accepts the sealed operation.

Dry run is the default:

```sh
node src/candlenut-label.mjs --root <actual-atlas-root> --intent <accepted-intent.json>
node src/candlenut-label.mjs --root <actual-atlas-root> --intent <accepted-intent.json> --write
node src/candlenut-label.mjs --root <actual-atlas-root> --intent <accepted-intent.json> --mode readback
node src/candlenut-label.mjs --root <actual-atlas-root> --intent <accepted-intent.json> --mode undo --expected-result-hash <exact-apply-result-hash> --write
```

The operation updates only candlenut's current nutrient values/source/note/evidence in both full manifests and corresponding JSONL/Parquet fields. Original `metadata.publicationRecord`, all source/image review metadata, other rows, aliases, household data, portions and every image byte remain intact. Compact manifests carry artwork rather than nutrients and remain unchanged.

`nutrition/candlenut-label.json` is the versionable canonical overlay. It contains the exact public label evidence and Atlas baseline hashes, with no Buna IDs or private storage/source-job IDs. `nutrition/candlenut-label.receipt.private.json` and pending/temp files are ignored. Guarded `applyCanonicalAdditions` reapplies the accepted overlay after its completed append/policy phases, so a fresh checkout can rebuild from canonical source with private operational receipts absent. Existing original addition records and their review seals are not rewritten.

The shared export-maintenance lock is acquired before baselines are read. Whole-file byte snapshots are retained across asynchronous Parquet reads and checked before staging and replacement. An interrupted write preserves a pending receipt and blocks all maintenance until explicitly reconciled; do not delete it or guess a baseline. Exact replay checks current values, evidence, note, schema and unrelated ingredient fields. Undo requires its result hash and refuses later changes or removal of a column now used by another ingredient.

Legacy private Parquet has no source columns. The operation adds nullable fields only where absent and preserves every old row value, including private identifiers. Whole-chicken policy schema checks recognize only these exact independently reviewed additions, with the canonical label source included in their snapshot check. Unexpected columns and unrelated schema edits remain conflicts.

The ordinary destructive builders are not invoked by this adapter. Use guarded canonical append/overlay restoration for this operation. Buna has a separate exact internal transaction; the two destinations do not share a transaction. Keep both readbacks and each undo receipt before declaring numeric synchronization complete.
