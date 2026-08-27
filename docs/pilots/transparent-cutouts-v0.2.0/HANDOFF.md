# Transparent cutout pilot handoff

## Goal

Produce transparent Ingredient Atlas variants without replacing the existing white-background assets. Keep the photographed cast shadow and never generate, blur, offset, or add a replacement shadow.

## Fixed pilot

`sample.json` contains 50 records across all 18 catalog categories. It includes pale subjects, thin herbs, glass, foil, liquids, piles, packaging, and broad or faint shadows.

The pipeline processes each original once:

1. `rembg` 2.0.75 with `isnet-general-use` extracts the subject alpha.
2. The script estimates the near-white studio background from the source.
3. It removes the estimated backing-plate color mixed into soft subject edges.
4. It measures source luminance loss across the full source, subtracts a noise floor measured on the clean backing plate, and stores the remaining darkening as a neutral shadow alpha. There is no fixed opacity cutoff or maximum alpha clip.
5. It writes a source-sized PNG master, 512px PNG, 512px WebP, subject matte, and shadow matte.
6. A second run compares file hashes and decoded pixels with the first run.

## Rejected BiRefNet baseline on the first Mac

- Source download: 50 files in 4.85 seconds using the public Hugging Face resolver, with no login.
- Python environment setup: 29.84 seconds once.
- BiRefNet model download: about 52 seconds once, 973 MB downloaded and 928 MiB on disk.
- First warm strawberry run: 20.62 seconds end to end, 14.23 seconds inside the image step, 8.84 seconds in model inference.
- Second warm strawberry run: 16.31 seconds end to end, 11.88 seconds inside the image step, 7.15 seconds in model inference.
- Peak resident memory: 7.60 GiB.
- Determinism sample: 1 of 1 records, all five generated files byte-identical. The 50-record repeat is still required.
- Paid services: 0 API calls, 0 image-generation tokens, $0 pipeline cost. Codex conversation usage is outside the script and is not exposed to it.
- Early full-set projection from one image: roughly 6 to 7.2 hours for 1,830 sources. Replace this estimate with the 50-image median.

## Verified pilot commands

The branch and scripts must exist on that Mac first. From the repository root:

```bash
node scripts/download-transparent-cutout-pilot.mjs

nice -n 10 uv run --python 3.13 scripts/prepare-transparent-cutout-pilot.py \
  --manifest data/manifest.compact.json \
  --sample docs/pilots/transparent-cutouts-v0.2.0/sample.json \
  --dataset-root public-dataset \
  --output-root public-dataset/pilots/transparent-cutouts-v0.2.0/candidate-run-1 \
  --strict-qa

nice -n 10 uv run --python 3.13 scripts/prepare-transparent-cutout-pilot.py \
  --manifest data/manifest.compact.json \
  --sample docs/pilots/transparent-cutouts-v0.2.0/sample.json \
  --dataset-root public-dataset \
  --output-root public-dataset/pilots/transparent-cutouts-v0.2.0/candidate-run-2 \
  --compare-to public-dataset/pilots/transparent-cutouts-v0.2.0/candidate-run-1 \
  --strict-qa
```

If a run stops, repeat the same command with `--resume`. Each successful record is appended to `progress.jsonl`, and cumulative time is checkpointed in `run-state.json`, before the next inference starts. A hard interruption can lose the time spent on the unfinished image, so resumed wall time is reported as a lower bound.

Inspect:

```bash
jq '{wall_seconds, runtime, timing, storage, determinism, cost, qa}' \
  public-dataset/pilots/transparent-cutouts-v0.2.0/candidate-run-2/summary.json
```

Review all four lossless PNG contact sheets in `candidate-run-2/contact-sheets/`. Approve the method only if pale edges survive, no white haze remains, the recovered shadows match the originals, and the dark-background sheet has no colored fringe.

## Rejected second-Mac baseline, 2026-08-25

The fixed 50-image pilot completed twice on an Apple M5 Pro Mac with 64 GiB of memory. All 50 source hashes matched the manifest, so the download step reused the local originals.

- Run 1: 50 succeeded, 0 failed, 7.64-second median, 9.53-second p95, 12.21 GiB peak resident memory.
- Run 2: 50 succeeded, 0 failed, 8.70-second median, 9.74-second p95, 13.57 GiB peak resident memory.
- Full-catalog projection: 3 hours 53 minutes from run 1 and 4 hours 25 minutes from run 2.
- Determinism: all 50 records and all five files per record were byte-identical and pixel-identical between runs.
- Storage projection: about 788 MB for the three publishable variants across 1,830 records, or about 843 MB including the two QA mattes.
- Script QA: 0 records flagged. Visual QA found a release-blocking false pass.

The BiRefNet method is not approved for the full run. On `spaghetti`, BiRefNet kept the pasta but omitted the bowl from the subject matte. Shadow recovery then interpreted the bowl as source luminance loss and emitted it as a dark circular shadow. The defect is easy to miss on white and obvious on the dark contact sheet. This is an existing object reclassified as shadow, not a photographed cast shadow.

`birefnet-general-lite` omitted the same bowl. `isnet-general-use` preserved the full composition, including the bowl, and left the photographed shadow separate.

## Accepted replacement, 2026-08-25

The fixed 50-image pilot completed twice with `isnet-general-use` and strict QA.

- Candidate run 1: 50 succeeded, 0 failed, 3.81-second median, 4.87-second p95, 3.31 GiB peak resident memory.
- Candidate run 2: 50 succeeded, 0 failed, 3.87-second median, 4.95-second p95, 3.34 GiB peak resident memory.
- Full-catalog projection: 1 hour 56 minutes from candidate run 1 and 1 hour 58 minutes from candidate run 2.
- Determinism: all 50 records and all five files per record were byte-identical and pixel-identical between candidate runs.
- Storage projection: about 811 MB for the three publishable variants across 1,830 records, or about 875 MB including the two QA mattes.
- Strict QA: 0 records flagged and 0 failures.
- Visual QA: the white, warm, dark, and checkerboard sheets passed. Pale edges, thin herbs, glass, foil, liquids, piles, packaging, and photographed shadows remained intact. No colored fringe was visible on the dark sheet.

The script now flags `shadow-dominates-subject` when a broad, high-alpha recovered shadow is much larger than the extracted subject. `--strict-qa` exits nonzero after writing the evidence when any record fails or receives a flag. The old model now fails this gate on `spaghetti`; the accepted model passes it.

For a targeted regression run, use `--slug spaghetti --strict-qa`. `--slug` may be repeated to test more pilot records without paying for a full 50-image run.

## Full-run decision

The full local generation run completed on 2026-08-26. All 1,830 source hashes matched the manifest, so the source check reused every local original and made no network requests.

- Full default-model pass: 1,830 succeeded, 0 failed, 2 hours 5 minutes wall time, 3.92-second median, 4.89-second p95, and 3.41 GiB peak resident memory.
- Storage: 882,186,231 bytes for all five generated files per record, including 824,967,514 bytes for the three publishable variants.
- Strict QA held 24 records: 16 `shadow-dominates-subject` and 8 `subject-near-edge`.
- Visual review accepted 8 conservative flags and found 16 real composition failures.
- A targeted `birefnet-general` repair pass preserved the complete composition on those 16 records. The reviewed exception list is in `model-overrides.json`.
- Reviewed set: 1,830 records, 0 failures, 1,814 from `isnet-general-use`, 16 from `birefnet-general`, and 148 paginated contact sheets.
- Reviewed storage: 881,525,114 bytes total, including 824,557,381 publishable bytes.
- Thirteen conservative flags remain after repair. All thirteen were inspected and accepted. Five belong to repaired records and eight to default-model records. The exact decisions are in `qa-review.md`.

The strict command still exits 2 because reviewed flags remain. That is an intentional review hold, not a processing failure. Use the summary's `failed: 0`, the per-record model field, and `qa-review.md` together when checking this run.

For a fresh reviewed run:

```bash
node scripts/download-transparent-cutout-pilot.mjs --all-records

nice -n 10 uv run --python 3.13 scripts/prepare-transparent-cutout-pilot.py \
  --manifest data/manifest.compact.json \
  --all-records \
  --dataset-root public-dataset \
  --output-root public-dataset/cutouts/v0.2.0/full-run-reviewed \
  --model-overrides docs/pilots/transparent-cutouts-v0.2.0/model-overrides.json \
  --strict-qa
```

If the default-model pass already exists in the chosen output root, add `--resume`. The script reuses matching checkpoints and reprocesses records whose reviewed model changed.

Publication remains a separate decision. No existing white-background asset was replaced by this run.

The published dataset should add three variants per record: cutout master PNG, cutout PNG 512, and cutout WebP 512. Keep the two mattes as build and review artifacts unless there is a clear public use for them.
