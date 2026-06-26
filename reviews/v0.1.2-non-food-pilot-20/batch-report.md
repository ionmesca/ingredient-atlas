# v0.1.2 Non-Food Pilot 20 Review

Status: local candidate, not published to npm or Hugging Face.

## Summary

- Generated records: 20
- Image files added locally: 60
- Source images: `reviews/v0.1.2-non-food-pilot-20/generated-sources/*.{webp,png}`
- Contact sheet: `reviews/v0.1.2-non-food-pilot-20/contact-sheet.png`
- Public dataset manifests and checksums were refreshed locally.

## Visual Rules Used

- Pure white background.
- Centered isolated subject.
- No brands, logos, readable text, hands, people, tables, lifestyle scenes, or decorative packaging.
- Generic blank packaging only when needed for recognition.
- No medical, dosage, certification, safety, or efficacy claims.
- Use realistic household quantities rather than bulk packs.

## Records

| slug | display name | kind | category | subcategory |
| --- | --- | --- | --- | --- |
| `paper-towels` | Paper Towels | household | household | paper goods |
| `toilet-paper` | Toilet Paper | household | household | paper goods |
| `tissues` | Tissues | household | household | paper goods |
| `freezer-bags` | Freezer Bags | household | household | kitchen supplies |
| `aluminum-foil` | Aluminum Foil | household | household | kitchen supplies |
| `parchment-paper` | Parchment Paper | household | household | kitchen supplies |
| `sponges` | Sponges | household | household | cleaning tools |
| `trash-bags` | Trash Bags | household | household | storage and bags |
| `dish-soap` | Dish Soap | household | household | dish care |
| `laundry-detergent` | Laundry Detergent | household | household | laundry |
| `batteries` | Batteries | household | household | home utility |
| `light-bulbs` | Light Bulbs | household | household | home utility |
| `shampoo` | Shampoo | personal | personal | hair care |
| `toothbrushes` | Toothbrushes | personal | personal | oral care |
| `dental-floss` | Dental Floss | personal | personal | oral care |
| `deodorant` | Deodorant | personal | personal | hygiene |
| `cotton-swabs` | Cotton Swabs | personal | personal | personal care |
| `bandages` | Bandages | personal | personal | first aid |
| `pet-waste-bags` | Pet Waste Bags | pet | pet | pet care |
| `pet-bowls` | Pet Bowls | pet | pet | pet supplies |

## Remaining Work Before Public Release

- Owner visual approval.
- Upload derived image files and refreshed public manifests to Hugging Face.
- Publish npm only after Hugging Face paths exist for every new compact manifest record.
