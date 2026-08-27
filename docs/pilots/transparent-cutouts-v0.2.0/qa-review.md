# Full-catalog QA review

Reviewed on 2026-08-26 against the original, master PNG, subject matte, shadow matte, and the white, warm, dark, and checkerboard composites.

## Accepted from the default model

These eight records triggered conservative checks but preserve the full photographed composition.

| Slug | Flag | Review decision |
| --- | --- | --- |
| `stollen` | `shadow-dominates-subject` | Loaf, slices, and the real broad cast shadow are intact. |
| `condensed-milk` | `subject-near-edge` | The poured milk stream legitimately enters from the top edge. |
| `almond-oil` | `shadow-dominates-subject` | Pitcher, glass edges, oil, almonds, and cast shadow are intact. |
| `vanilla-bean` | `shadow-dominates-subject` | The full thin subject and its edge detail are intact. |
| `burdock-root` | `shadow-dominates-subject` | The full root, hairs, and photographed shadow are intact. |
| `garland-chrysanthemum` | `subject-near-edge` | The lower stem legitimately reaches the bottom edge. |
| `kidney-mature-seed-sprouted-bean` | `shadow-dominates-subject` | The bean, sprout, and photographed shadow are intact. |
| `sugar-apple` | `shadow-dominates-subject` | The fruit and photographed base shadow are intact. |

## Replaced with the reviewed alternate model

These sixteen records lost part of the composition or retained source background with `isnet-general-use`. Their reviewed output uses `birefnet-general`, as recorded in `model-overrides.json` and each record in the reviewed summary.

| Slug | Default-model defect |
| --- | --- |
| `green-tea` | Loose tea became a dark patch with colored fringe. |
| `ground-coffee` | White background remained above the bowl. |
| `port-wine` | Colored artifacts remained beside the glass. |
| `triple-sec` | A reflected stem ran off the bottom edge. |
| `tamarind-paste` | White background remained above and beside the bowl. |
| `fresh-egg-pasta` | A white background fragment remained at lower right. |
| `yellow-lentils` | White background fragments remained around the bowl. |
| `leafy-tip-cowpea` | A vertical source-background strip remained at the left edge. |
| `dried-thyme` | The herb sprig disappeared and the bowl interior became transparent. |
| `horseradish-powder` | Most of the spoon disappeared. |
| `mace` | The whole mace piece disappeared and the bowl edge had colored residue. |
| `pasilla-chili` | The green chili and leaves nearly disappeared on dark backgrounds. |
| `poultry-seasoning` | The bowl and rosemary sprig were partly removed. |
| `zaatar-blend` | The bowl and thyme sprig were removed. |
| `mussel` | The supporting plate was removed. |
| `snail-mollusk` | The supporting plate was removed. |

The reviewed alternate sheets preserve all sixteen complete compositions. Five still trigger conservative metric checks: `port-wine`, `leafy-tip-cowpea`, `pasilla-chili`, `mussel`, and `snail-mollusk`. Visual review accepted them. The broad shadows and legitimate edge contact explain the flags.

## Review boundary

The full dark-background overview and every flagged source/output pair were inspected. The 16-item alternate pass was inspected on all four backgrounds. This approves the generated reviewed set for publication preparation. It does not publish or replace the existing white-background dataset.
