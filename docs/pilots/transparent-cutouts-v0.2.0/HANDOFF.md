# Transparent cutout pilot handoff

## Goal

Produce transparent Ingredient Atlas variants without replacing the existing white-background assets. Keep the photographed cast shadow and never generate, blur, offset, or add a replacement shadow.

## Fixed pilot

`sample.json` contains 50 records across all 18 catalog categories. It includes pale subjects, thin herbs, glass, foil, liquids, piles, packaging, and broad or faint shadows.

The pipeline processes each original once:

1. `rembg` 2.0.75 with `birefnet-general` extracts the subject alpha.
2. The script estimates the near-white studio background from the source.
3. It removes the estimated backing-plate color mixed into soft subject edges.
4. It measures source luminance loss across the full source, subtracts a noise floor measured on the clean backing plate, and stores the remaining darkening as a neutral shadow alpha. There is no fixed opacity cutoff or maximum alpha clip.
5. It writes a source-sized PNG master, 512px PNG, 512px WebP, subject matte, and shadow matte.
6. A second run compares file hashes and decoded pixels with the first run.

## Measured on the first Mac

- Source download: 50 files in 4.85 seconds using the public Hugging Face resolver, with no login.
- Python environment setup: 29.84 seconds once.
- BiRefNet model download: about 52 seconds once, 973 MB downloaded and 928 MiB on disk.
- First warm strawberry run: 20.62 seconds end to end, 14.23 seconds inside the image step, 8.84 seconds in model inference.
- Second warm strawberry run: 16.31 seconds end to end, 11.88 seconds inside the image step, 7.15 seconds in model inference.
- Peak resident memory: 7.60 GiB.
- Determinism sample: 1 of 1 records, all five generated files byte-identical. The 50-record repeat is still required.
- Paid services: 0 API calls, 0 image-generation tokens, $0 pipeline cost. Codex conversation usage is outside the script and is not exposed to it.
- Early full-set projection from one image: roughly 6 to 7.2 hours for 1,830 sources. Replace this estimate with the 50-image median.

## Run on the second Mac

The branch and scripts must exist on that Mac first. From the repository root:

```bash
node scripts/download-transparent-cutout-pilot.mjs

nice -n 10 uv run --python 3.13 scripts/prepare-transparent-cutout-pilot.py \
  --manifest data/manifest.compact.json \
  --sample docs/pilots/transparent-cutouts-v0.2.0/sample.json \
  --dataset-root public-dataset \
  --output-root public-dataset/pilots/transparent-cutouts-v0.2.0/run-1

nice -n 10 uv run --python 3.13 scripts/prepare-transparent-cutout-pilot.py \
  --manifest data/manifest.compact.json \
  --sample docs/pilots/transparent-cutouts-v0.2.0/sample.json \
  --dataset-root public-dataset \
  --output-root public-dataset/pilots/transparent-cutouts-v0.2.0/run-2 \
  --compare-to public-dataset/pilots/transparent-cutouts-v0.2.0/run-1
```

If a run stops, repeat the same command with `--resume`. Each successful record is appended to `progress.jsonl`, and cumulative time is checkpointed in `run-state.json`, before the next inference starts. A hard interruption can lose the time spent on the unfinished image, so resumed wall time is reported as a lower bound.

Inspect:

```bash
jq '{wall_seconds, runtime, timing, storage, determinism, cost, qa}' \
  public-dataset/pilots/transparent-cutouts-v0.2.0/run-2/summary.json
```

Review all four lossless PNG contact sheets in `run-2/contact-sheets/`. Approve the method only if pale edges survive, no white haze remains, the recovered shadows match the originals, and the dark-background sheet has no colored fringe.

## Full-run decision

Do not process all 1,830 sources yet. Use the 50-image results to decide whether `birefnet-general` is worth its 7.6 GiB memory use and projected runtime. If the new Mac is materially faster, keep it. If not, compare the same 50 sources with `birefnet-general-lite` before changing the production model.

The published dataset should add three variants per record: cutout master PNG, cutout PNG 512, and cutout WebP 512. Keep the two mattes as build and review artifacts unless there is a clear public use for them.
