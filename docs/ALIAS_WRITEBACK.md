# Exact ingredient alias writeback

The reviewed `kecap manis` correction removes that exact alias from salty `soy-sauce` and resolves it to `indonesian-sweet-soy-sauce`. Existing IDs, recipe references, names, other aliases, nutrition and image bytes stay unchanged. Generic `ketjap` is outside this operation.

`aliases/overrides.json` is the public-safe, versionable source. It contains independently reviewed before/after alias bindings and hashes of the unaffected record fields. It contains no operational database IDs, storage IDs, private source metadata or credentials. Private transaction/readback receipts are ignored.

Before application, prepare the exact intent from both current full exports and their JSONL, Parquet and compact variants with `captureAliasIntent`. A separate reviewer accepts its immutable hash. The command defaults to a dry run:

```sh
node src/alias-writeback.mjs --root /path/to/ingredient-atlas --intent /path/to/reviewed-intent.json
node src/alias-writeback.mjs --root /path/to/ingredient-atlas --intent /path/to/reviewed-intent.json --write
node src/alias-writeback.mjs --root /path/to/ingredient-atlas --intent /path/to/reviewed-intent.json --mode readback
```

The adapter compares the exact aliases, stable IDs, unaffected metadata and embedded resolver records. It removes only one exact string, transfers one resolver key, and preserves every unrelated row and all image/checksum files. Replay checks every derivative. Undo requires the original applied receipt and exact result hash; later changes to protected records block undo instead of overwriting them. Alias, nutrition, addition and source-install writers acquire the same atomic exclusive export-maintenance lock before reading baselines, and keep it through writes/readback. A leftover or active lock blocks work until its owner finishes or it is reconciled; it is never silently stolen.

After an approved rebuild, use the existing guarded canonical append command, `node src/catalog-additions.mjs --write`. It also reapplies the accepted alias source after additions, including when private receipts are absent. An interrupted alias transaction blocks this command before any append. Default legacy builders remain outside the certified maintenance path; they may prefer live metadata or recreate images and must not be used as a shortcut.

The pure `overlayAliases` helper is available for builder integration. It accepts the reviewed before or after alias array, removes the wrong alias and leaves other fields intact. Unknown alias changes fail closed. Neither this operation nor its rebuild hook changes a live application database or publishes a dataset/package.
