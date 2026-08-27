#!/usr/bin/env -S uv run --python 3.13 --script
# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = [
#   "numpy==2.3.2",
#   "pillow==12.1.0",
#   "rembg[cpu]==2.0.75",
# ]
# ///
"""Create and measure a deterministic Ingredient Atlas cutout pilot."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import platform
import resource
import statistics
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from rembg import new_session, remove

BACKGROUNDS = {
    "white": (255, 255, 255, 255),
    "warm": (240, 237, 231, 255),
    "dark": (43, 43, 43, 255),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def percentile(values: list[float], position: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(len(ordered) * position) - 1))
    return ordered[index]


def preserve_studio_shadow(
    original: Image.Image,
    cutout: Image.Image,
    shadow_radius: int,
) -> tuple[Image.Image, Image.Image, Image.Image, dict[str, float]]:
    """Recover only the photographed darkening around a near-white subject."""

    if original.size != cutout.size:
        raise ValueError("Original and cutout dimensions must match")

    original_rgb = np.asarray(original.convert("RGB"), dtype=np.float32) / 255
    subject_alpha_image = cutout.getchannel("A")
    subject_alpha = np.asarray(subject_alpha_image, dtype=np.float32) / 255
    height, width = subject_alpha.shape

    x = np.linspace(-1, 1, width, dtype=np.float32)
    y = np.linspace(-1, 1, height, dtype=np.float32)
    grid_x, grid_y = np.meshgrid(x, y)
    design = np.stack(
        (
            np.ones_like(grid_x),
            grid_x,
            grid_y,
            grid_x * grid_x,
            grid_x * grid_y,
            grid_y * grid_y,
        ),
        axis=-1,
    )

    luminance = (
        original_rgb[..., 0] * 0.2126
        + original_rgb[..., 1] * 0.7152
        + original_rgb[..., 2] * 0.0722
    )
    outside_subject = subject_alpha < 0.02
    if np.count_nonzero(outside_subject) < 1000:
        raise ValueError("Not enough background pixels outside the subject")

    bright_cutoff = np.percentile(luminance[outside_subject], 65)
    background_sample = outside_subject & (luminance >= bright_cutoff)
    if np.count_nonzero(background_sample) < 1000:
        raise ValueError("Not enough clean background pixels to recover the shadow")

    sample_design = design[background_sample]
    background = np.empty_like(original_rgb)
    for channel in range(3):
        coefficients, *_ = np.linalg.lstsq(
            sample_design,
            original_rgb[..., channel][background_sample],
            rcond=None,
        )
        background[..., channel] = design @ coefficients
    background = np.clip(background, 0.01, 1)

    background_luminance = (
        background[..., 0] * 0.2126
        + background[..., 1] * 0.7152
        + background[..., 2] * 0.0722
    )
    raw_shadow_alpha = np.maximum(
        (background_luminance - luminance) / background_luminance,
        0,
    )
    # Measure the backing-plate/model residual on the clean bright sample rather
    # than deleting every shadow below a fixed opacity. Subtracting this local
    # noise floor keeps faint photographed shadows that rise above source noise.
    shadow_noise_floor = float(np.percentile(raw_shadow_alpha[background_sample], 99.5))
    shadow_alpha = np.clip(
        (raw_shadow_alpha - shadow_noise_floor) / max(1 - shadow_noise_floor, 0.01),
        0,
        1,
    )

    if shadow_radius > 0:
        subject_mask = subject_alpha_image.point(lambda value: 255 if value > 8 else 0)
        vicinity_size = shadow_radius * 2 + 1
        vicinity_image = subject_mask.filter(ImageFilter.MaxFilter(vicinity_size))
        vicinity_image = vicinity_image.filter(
            ImageFilter.GaussianBlur(max(1, shadow_radius / 3))
        )
        vicinity = np.asarray(vicinity_image, dtype=np.float32) / 255
        shadow_alpha *= vicinity
    shadow_alpha *= 1 - subject_alpha

    # Recover the subject color that was mixed with the photographed backing
    # plate at soft edges. This is the source-aware equivalent of color
    # decontamination and avoids preserving a white fringe in the cutout.
    safe_subject_alpha = np.maximum(subject_alpha[..., np.newaxis], 0.01)
    foreground_rgb = (
        original_rgb - (1 - subject_alpha[..., np.newaxis]) * background
    ) / safe_subject_alpha
    foreground_rgb = np.clip(foreground_rgb, 0, 1)
    foreground_rgb = np.where(
        subject_alpha[..., np.newaxis] >= 0.005,
        foreground_rgb,
        0,
    )
    subject_rgba = np.dstack(
        (
            np.round(foreground_rgb * 255).astype(np.uint8),
            np.round(subject_alpha * 255).astype(np.uint8),
        )
    )

    shadow_alpha_u8 = np.round(shadow_alpha * 255).astype(np.uint8)
    shadow_rgba = np.zeros((height, width, 4), dtype=np.uint8)
    shadow_rgba[..., 3] = shadow_alpha_u8
    shadow = Image.fromarray(shadow_rgba, "RGBA")
    subject = Image.fromarray(subject_rgba, "RGBA")
    merged = Image.alpha_composite(shadow, subject)

    shadow_pixels = int(np.count_nonzero(shadow_alpha_u8 >= 2))
    metrics = {
        "subject_alpha_fraction": float(
            np.count_nonzero(subject_alpha >= 0.02) / subject_alpha.size
        ),
        "shadow_alpha_fraction": float(shadow_pixels / shadow_alpha.size),
        "shadow_alpha_mean": float(shadow_alpha.mean()),
        "shadow_alpha_max": float(shadow_alpha.max()),
        "shadow_noise_floor": shadow_noise_floor,
        "background_brightness_cutoff": float(bright_cutoff),
    }
    return merged, subject_alpha_image, Image.fromarray(shadow_alpha_u8, "L"), metrics


def normalize(
    image: Image.Image,
    subject_alpha: Image.Image,
    canvas: int,
    extent: int,
) -> Image.Image:
    visible = subject_alpha.point(lambda value: 255 if value > 8 else 0)
    bounds = visible.getbbox()
    if bounds is None:
        raise ValueError("No visible subject pixels")

    subject_width = bounds[2] - bounds[0]
    subject_height = bounds[3] - bounds[1]
    scale = min(extent / subject_width, extent / subject_height)
    resized = image.resize(
        (
            max(1, round(image.width * scale)),
            max(1, round(image.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    subject_center_x = (bounds[0] + bounds[2]) * scale / 2
    subject_center_y = (bounds[1] + bounds[3]) * scale / 2
    normalized = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    normalized.alpha_composite(
        resized,
        (
            round(canvas / 2 - subject_center_x),
            round(canvas / 2 - subject_center_y),
        ),
    )
    return normalized


def recomposition_mae(original: Image.Image, master: Image.Image) -> float:
    white = Image.new("RGBA", master.size, (255, 255, 255, 255))
    white.alpha_composite(master)
    source = np.asarray(original.convert("RGB"), dtype=np.int16)
    restored = np.asarray(white.convert("RGB"), dtype=np.int16)
    alpha = np.asarray(master.getchannel("A"), dtype=np.uint8)
    area = Image.fromarray(alpha, "L").filter(ImageFilter.MaxFilter(81))
    mask = np.asarray(area, dtype=np.uint8) > 2
    if not np.any(mask):
        return 255.0
    return float(np.abs(source - restored)[mask].mean())


def save_outputs(
    output_root: Path,
    relative_stem: Path,
    master: Image.Image,
    subject_alpha: Image.Image,
    shadow_matte: Image.Image,
    canvas: int,
    extent: int,
) -> dict[str, Path]:
    paths = {
        "master": output_root / "masters" / relative_stem.with_suffix(".png"),
        "subject_alpha": output_root
        / "subject-mattes"
        / relative_stem.with_suffix(".png"),
        "shadow_alpha": output_root
        / "shadow-mattes"
        / relative_stem.with_suffix(".png"),
        "png512": output_root / "png" / "512" / relative_stem.with_suffix(".png"),
        "webp512": output_root / "webp" / "512" / relative_stem.with_suffix(".webp"),
    }
    for path in paths.values():
        path.parent.mkdir(parents=True, exist_ok=True)

    master.save(paths["master"], "PNG", compress_level=9)
    subject_alpha.save(paths["subject_alpha"], "PNG", compress_level=9)
    shadow_matte.save(paths["shadow_alpha"], "PNG", compress_level=9)
    normalized = normalize(master, subject_alpha, canvas, extent)
    normalized.save(paths["png512"], "PNG", compress_level=9)
    normalized.save(paths["webp512"], "WEBP", quality=90, method=6, exact=True)
    return paths


def compare_output_determinism(
    previous_root: Path | None, output_root: Path, paths: dict[str, Path]
) -> dict[str, Any] | None:
    if previous_root is None:
        return None
    compared = []
    for label, current in paths.items():
        relative = current.relative_to(output_root)
        previous = previous_root / relative
        pixel_identical = False
        max_channel_delta = None
        mean_channel_delta = None
        if previous.exists():
            with (
                Image.open(previous) as previous_image,
                Image.open(current) as current_image,
            ):
                previous_pixels = np.asarray(
                    previous_image.convert("RGBA"), dtype=np.int16
                )
                current_pixels = np.asarray(
                    current_image.convert("RGBA"), dtype=np.int16
                )
            if previous_pixels.shape == current_pixels.shape:
                delta = np.abs(previous_pixels - current_pixels)
                pixel_identical = bool(np.all(delta == 0))
                max_channel_delta = int(delta.max())
                mean_channel_delta = float(delta.mean())
        compared.append(
            {
                "variant": label,
                "relative_path": str(relative),
                "previous_exists": previous.exists(),
                "byte_identical": previous.exists()
                and sha256(previous) == sha256(current),
                "pixel_identical": pixel_identical,
                "max_channel_delta": max_channel_delta,
                "mean_channel_delta": mean_channel_delta,
            }
        )
    return {
        "files": compared,
        "all_byte_identical": all(item["byte_identical"] for item in compared),
        "all_pixel_identical": all(item["pixel_identical"] for item in compared),
    }


def checkerboard(size: tuple[int, int], cell: int = 16) -> Image.Image:
    width, height = size
    board = Image.new("RGBA", size, (232, 232, 232, 255))
    draw = ImageDraw.Draw(board)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle(
                    (x, y, x + cell - 1, y + cell - 1), fill=(204, 204, 204, 255)
                )
    return board


def create_contact_sheets(
    records: list[dict[str, Any]],
    output_root: Path,
    background_name: str,
    columns: int = 5,
    page_size: int = 50,
) -> list[Path]:
    tile = 180
    label_height = 28
    destinations = []
    pages = [records[index : index + page_size] for index in range(0, len(records), page_size)]
    for page_index, page_records in enumerate(pages, start=1):
        rows = math.ceil(len(page_records) / columns)
        sheet = Image.new(
            "RGB", (columns * tile, rows * (tile + label_height)), "white"
        )
        font = ImageFont.load_default(size=13)
        for index, record in enumerate(page_records):
            master = Image.open(record["outputs"]["master"]).convert("RGBA")
            if background_name == "checker":
                background = checkerboard((tile, tile))
            else:
                background = Image.new(
                    "RGBA", (tile, tile), BACKGROUNDS[background_name]
                )
            preview = master.copy()
            preview.thumbnail((tile - 20, tile - 20), Image.Resampling.LANCZOS)
            background.alpha_composite(
                preview, ((tile - preview.width) // 2, (tile - preview.height) // 2)
            )
            x = (index % columns) * tile
            y = (index // columns) * (tile + label_height)
            sheet.paste(background.convert("RGB"), (x, y))
            draw = ImageDraw.Draw(sheet)
            draw.text(
                (x + 8, y + tile + 7), record["slug"], font=font, fill="#262626"
            )

        suffix = "" if len(pages) == 1 else f"-{page_index:03d}"
        destination = (
            output_root
            / "contact-sheets"
            / f"contact-{background_name}{suffix}.png"
        )
        destination.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(destination, "PNG", compress_level=9)
        destinations.append(destination)
    return destinations


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--sample", type=Path)
    selection.add_argument(
        "--all-records",
        action="store_true",
        help="Process every manifest record in category and slug order.",
    )
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--compare-to", type=Path)
    parser.add_argument("--model", default="isnet-general-use")
    parser.add_argument(
        "--model-overrides",
        type=Path,
        help="JSON object mapping reviewed slugs to alternate rembg model names.",
    )
    parser.add_argument("--canvas", type=int, default=512)
    parser.add_argument("--extent", type=int, default=410)
    parser.add_argument(
        "--shadow-radius",
        type=int,
        default=0,
        help="Optional subject-vicinity limit in pixels; 0 preserves the full source shadow",
    )
    parser.add_argument(
        "--slug",
        action="append",
        dest="slugs",
        help="Process only this pilot slug. Repeat to select more than one.",
    )
    parser.add_argument("--limit", type=int)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument(
        "--strict-qa",
        action="store_true",
        help="Exit nonzero after writing outputs when any record fails or is flagged.",
    )
    args = parser.parse_args()

    if args.shadow_radius < 0:
        raise SystemExit("--shadow-radius must be 0 or greater")

    manifest = json.loads(args.manifest.read_text())
    records_by_slug = manifest["recordsBySlug"]
    model_overrides: dict[str, str] = {}
    if args.model_overrides:
        model_overrides = json.loads(args.model_overrides.read_text())
        if not isinstance(model_overrides, dict) or not all(
            isinstance(slug, str) and isinstance(model, str) and model
            for slug, model in model_overrides.items()
        ):
            raise SystemExit("--model-overrides must be a JSON object of slug to model")
        unknown_override_slugs = sorted(set(model_overrides) - set(records_by_slug))
        if unknown_override_slugs:
            raise SystemExit(
                "Model overrides contain unknown slugs: "
                + ", ".join(unknown_override_slugs)
            )
    if args.all_records:
        sample = {
            "id": "transparent-cutouts-v0.2.0-full",
            "slugs": sorted(
                records_by_slug,
                key=lambda slug: (records_by_slug[slug]["category"], slug),
            ),
        }
    else:
        sample = json.loads(args.sample.read_text())
    if not args.all_records and (
        len(sample["slugs"]) != 50 or len(set(sample["slugs"])) != 50
    ):
        raise SystemExit("Pilot sample must contain exactly 50 unique slugs")

    missing_records = [slug for slug in sample["slugs"] if slug not in records_by_slug]
    if missing_records:
        raise SystemExit(f"Missing manifest records: {', '.join(missing_records)}")

    missing_sources = []
    sources: list[tuple[str, dict[str, Any], Path]] = []
    for slug in sample["slugs"]:
        record = records_by_slug[slug]
        source = args.dataset_root / record["images"]["original"]["path"]
        if not source.exists():
            missing_sources.append(str(source))
        sources.append((slug, record, source))
    if missing_sources:
        raise SystemExit("Missing pilot sources:\n" + "\n".join(missing_sources))

    if args.slugs:
        requested_slugs = list(dict.fromkeys(args.slugs))
        unknown_slugs = [slug for slug in requested_slugs if slug not in sample["slugs"]]
        if unknown_slugs:
            raise SystemExit(
                "Requested slugs are not in the fixed pilot: "
                + ", ".join(unknown_slugs)
            )
        requested_slug_set = set(requested_slugs)
        sources = [item for item in sources if item[0] in requested_slug_set]

    if args.limit is not None:
        if args.limit < 1:
            raise SystemExit("--limit must be at least 1")
        sources = sources[: args.limit]

    args.output_root.mkdir(parents=True, exist_ok=True)
    progress_path = args.output_root / "progress.jsonl"
    state_path = args.output_root / "run-state.json"
    summary_path = args.output_root / "summary.json"
    results: list[dict[str, Any]] = []
    previous_state: dict[str, Any] = {}
    checkpoint_default_model = args.model
    if args.resume and progress_path.exists():
        if summary_path.exists():
            checkpoint_default_model = json.loads(summary_path.read_text()).get(
                "model", args.model
            )
        checkpoint_results = [
            json.loads(line)
            for line in progress_path.read_text().splitlines()
            if line.strip()
        ]
        latest_by_slug = {item["slug"]: item for item in checkpoint_results}
        results = [
            latest_by_slug[slug]
            for slug, _, _ in sources
            if slug in latest_by_slug
        ]
        if state_path.exists():
            previous_state = json.loads(state_path.read_text())
    elif progress_path.exists():
        raise SystemExit(
            f"{progress_path} already exists. Use --resume or choose a new output root."
        )
    completed_slugs = {
        item["slug"]
        for item in results
        if item.get("model", checkpoint_default_model)
        == model_overrides.get(item["slug"], args.model)
    }

    invocation_started_at = datetime.now(UTC)
    started_at = previous_state.get("started_at", invocation_started_at.isoformat())
    previous_wall_seconds = float(previous_state.get("wall_seconds", 0))
    previous_model_session_seconds = float(
        previous_state.get("model_session_seconds", 0)
    )
    wall_start = time.perf_counter()
    sessions: dict[str, Any] = {}
    session_seconds = 0.0

    def session_for(model: str) -> Any:
        nonlocal session_seconds
        if model not in sessions:
            session_start = time.perf_counter()
            sessions[model] = new_session(model)
            session_seconds += time.perf_counter() - session_start
        return sessions[model]

    def write_run_state() -> None:
        current_state = {
            "started_at": started_at,
            "last_checkpoint_at": datetime.now(UTC).isoformat(),
            "wall_seconds": previous_wall_seconds + (time.perf_counter() - wall_start),
            "model_session_seconds": previous_model_session_seconds + session_seconds,
            "completed_records": len(results),
            "timing_note": (
                "Checkpointed cumulative wall time. After an interrupted run, time "
                "spent on the unfinished image is not measurable and is excluded."
            ),
        }
        temporary_state = state_path.with_suffix(".tmp")
        temporary_state.write_text(json.dumps(current_state, indent=2) + "\n")
        temporary_state.replace(state_path)

    failures: list[dict[str, str]] = []
    for index, (slug, record, source_path) in enumerate(sources, start=1):
        if slug in completed_slugs:
            print(f"[{index:02d}/{len(sources)}] {slug}: reused checkpoint", flush=True)
            continue
        item_start = time.perf_counter()
        try:
            with Image.open(source_path) as source_image:
                original = source_image.convert("RGB")

            inference_start = time.perf_counter()
            model = model_overrides.get(slug, args.model)
            cutout = remove(original, session=session_for(model)).convert("RGBA")
            inference_seconds = time.perf_counter() - inference_start

            shadow_start = time.perf_counter()
            master, subject_alpha, shadow_matte, metrics = preserve_studio_shadow(
                original,
                cutout,
                args.shadow_radius,
            )
            shadow_seconds = time.perf_counter() - shadow_start

            encode_start = time.perf_counter()
            category = record["category"]
            relative_stem = Path(category) / slug
            paths = save_outputs(
                args.output_root,
                relative_stem,
                master,
                subject_alpha,
                shadow_matte,
                args.canvas,
                args.extent,
            )
            encode_seconds = time.perf_counter() - encode_start

            qa_flags = []
            bounds = subject_alpha.point(
                lambda value: 255 if value > 8 else 0
            ).getbbox()
            if bounds is None:
                qa_flags.append("missing-subject")
            else:
                margin = min(
                    bounds[0],
                    bounds[1],
                    original.width - bounds[2],
                    original.height - bounds[3],
                )
                if margin < 2:
                    qa_flags.append("subject-near-edge")
            if metrics["subject_alpha_fraction"] < 0.01:
                qa_flags.append("very-small-subject")
            if metrics["subject_alpha_fraction"] > 0.75:
                qa_flags.append("very-large-subject")
            if metrics["shadow_alpha_fraction"] < 0.001:
                qa_flags.append("little-or-no-shadow")
            if (
                metrics["shadow_alpha_fraction"]
                > metrics["subject_alpha_fraction"] * 1.5
                and metrics["shadow_alpha_max"] > 0.8
            ):
                qa_flags.append("shadow-dominates-subject")

            recompose_error = recomposition_mae(original, master)
            if recompose_error > 12:
                qa_flags.append("high-white-recomposition-error")

            output_info = {
                label: {
                    "path": str(path),
                    "bytes": path.stat().st_size,
                    "sha256": sha256(path),
                }
                for label, path in paths.items()
            }
            deterministic = compare_output_determinism(
                args.compare_to,
                args.output_root,
                paths,
            )
            result = {
                "index": index,
                "slug": slug,
                "category": record["category"],
                "model": model,
                "source": str(source_path),
                "source_bytes": source_path.stat().st_size,
                "source_sha256": sha256(source_path),
                "inference_seconds": inference_seconds,
                "shadow_recovery_seconds": shadow_seconds,
                "encoding_seconds": encode_seconds,
                "total_seconds": time.perf_counter() - item_start,
                "white_recomposition_mae": recompose_error,
                "metrics": metrics,
                "qa_flags": qa_flags,
                "outputs": {label: info["path"] for label, info in output_info.items()},
                "output_files": output_info,
                "determinism": deterministic,
                "process_peak_rss_bytes": peak_rss_bytes(),
            }
            results = [item for item in results if item["slug"] != slug]
            results.append(result)
            with progress_path.open("a") as progress:
                progress.write(json.dumps(result) + "\n")
            write_run_state()
            print(
                f"[{index:02d}/{len(sources)}] {slug}: {result['total_seconds']:.2f}s, "
                f"shadow={metrics['shadow_alpha_fraction']:.3%}, flags={','.join(qa_flags) or 'none'}",
                flush=True,
            )
        except Exception as error:  # noqa: BLE001
            failures.append({"slug": slug, "error": f"{type(error).__name__}: {error}"})
            print(f"[{index:02d}/{len(sources)}] {slug}: FAILED {error}", flush=True)

    source_order = {slug: index for index, (slug, _, _) in enumerate(sources)}
    results.sort(key=lambda item: source_order[item["slug"]])
    for item in results:
        item.setdefault("model", checkpoint_default_model)

    contact_sheets = []
    for name in ["white", "warm", "dark", "checker"]:
        contact_sheets.extend(
            str(path)
            for path in create_contact_sheets(results, args.output_root, name)
        )

    timings = [item["total_seconds"] for item in results]
    inference_timings = [item["inference_seconds"] for item in results]
    all_deterministic = [
        item["determinism"]["all_byte_identical"]
        for item in results
        if item["determinism"] is not None
    ]
    all_pixel_deterministic = [
        item["determinism"]["all_pixel_identical"]
        for item in results
        if item["determinism"] is not None
    ]
    generated_bytes = sum(
        file["bytes"] for item in results for file in item["output_files"].values()
    )
    publishable_bytes = sum(
        item["output_files"][variant]["bytes"]
        for item in results
        for variant in ["master", "png512", "webp512"]
    )
    qa_matte_bytes = sum(
        item["output_files"][variant]["bytes"]
        for item in results
        for variant in ["subject_alpha", "shadow_alpha"]
    )
    invocation_wall_seconds = time.perf_counter() - wall_start
    cumulative_wall_seconds = previous_wall_seconds + invocation_wall_seconds
    summary = {
        "pilot_id": sample["id"],
        "started_at": started_at,
        "invocation_started_at": invocation_started_at.isoformat(),
        "completed_at": datetime.now(UTC).isoformat(),
        "wall_seconds": cumulative_wall_seconds,
        "invocation_wall_seconds": invocation_wall_seconds,
        "wall_time_is_lower_bound_after_interruption": bool(args.resume),
        "wall_time_note": (
            "Cumulative checkpointed wall time. If a prior process was interrupted, "
            "time spent on its unfinished image cannot be recovered."
        ),
        "model_session_seconds": previous_model_session_seconds + session_seconds,
        "sample_size": len(sources),
        "successful": len(results),
        "failed": len(failures),
        "model": args.model,
        "model_overrides": model_overrides,
        "model_counts": {
            model: sum(item.get("model", args.model) == model for item in results)
            for model in sorted({item.get("model", args.model) for item in results})
        },
        "runtime": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "machine": platform.machine(),
            "rembg": importlib.metadata.version("rembg"),
            "onnxruntime": importlib.metadata.version("onnxruntime"),
            "numpy": importlib.metadata.version("numpy"),
            "pillow": importlib.metadata.version("pillow"),
            "process_peak_rss_bytes": peak_rss_bytes(),
            "process_peak_rss_gib": peak_rss_bytes() / 1024**3,
        },
        "timing": {
            "median_seconds_per_image": statistics.median(timings) if timings else 0,
            "p95_seconds_per_image": percentile(timings, 0.95),
            "median_inference_seconds": statistics.median(inference_timings)
            if inference_timings
            else 0,
            "projected_1830_wall_seconds": statistics.median(timings) * 1830
            if timings
            else 0,
        },
        "storage": {
            "source_bytes": sum(item["source_bytes"] for item in results),
            "generated_bytes": generated_bytes,
            "publishable_bytes": publishable_bytes,
            "qa_matte_bytes": qa_matte_bytes,
            "projected_1830_generated_bytes": (
                generated_bytes / len(results) * 1830 if results else 0
            ),
            "projected_1830_publishable_bytes": (
                publishable_bytes / len(results) * 1830 if results else 0
            ),
        },
        "determinism": {
            "compared_to": str(args.compare_to) if args.compare_to else None,
            "records_compared": len(all_deterministic),
            "records_byte_identical": sum(all_deterministic),
            "fraction_byte_identical": (
                sum(all_deterministic) / len(all_deterministic)
                if all_deterministic
                else None
            ),
            "records_pixel_identical": sum(all_pixel_deterministic),
            "fraction_pixel_identical": (
                sum(all_pixel_deterministic) / len(all_pixel_deterministic)
                if all_pixel_deterministic
                else None
            ),
        },
        "cost": {
            "paid_api_calls": 0,
            "image_generation_tokens": 0,
            "estimated_pipeline_cost_usd": 0,
            "scope_note": "Local background removal only. Codex conversation usage is not exposed to this script.",
        },
        "qa": {
            "records_with_flags": sum(bool(item["qa_flags"]) for item in results),
            "flag_counts": {
                flag: sum(flag in item["qa_flags"] for item in results)
                for flag in sorted(
                    {flag for item in results for flag in item["qa_flags"]}
                )
            },
            "failures": failures,
        },
        "contact_sheets": contact_sheets,
        "records": results,
    }
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    write_run_state()
    print(
        json.dumps(
            {
                key: summary[key]
                for key in [
                    "wall_seconds",
                    "successful",
                    "failed",
                    "timing",
                    "storage",
                    "determinism",
                    "cost",
                    "qa",
                ]
            },
            indent=2,
        )
    )
    if args.strict_qa and (summary["failed"] or summary["qa"]["records_with_flags"]):
        raise SystemExit(2)


def peak_rss_bytes() -> int:
    """Return peak resident memory in bytes on macOS, KiB elsewhere."""

    value = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    return value if platform.system() == "Darwin" else value * 1024


if __name__ == "__main__":
    main()
