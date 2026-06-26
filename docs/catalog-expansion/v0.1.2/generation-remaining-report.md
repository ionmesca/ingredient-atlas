# v0.1.2 Generation Remaining Report

Status: local candidate planning report. Not a public release.

Generated from `docs/catalog-expansion/v0.1.2/catalog-expansion-candidates.json` and `data/manifest.compact.json` after the v0.1.2 food batch and non-food pilot were applied.

## Summary

- Queued image-generation candidates: 157
- Generated candidate records: 40
- Remaining image-generation candidates: 117

## Generated So Far

| kind | generated |
| --- | ---: |
| food | 20 |
| household | 12 |
| personal | 6 |
| pet | 2 |
| total | 40 |

The generated count includes the first 20 food records and the 20-item non-food pilot. The 5 food quantity-realism corrections improved existing generated records and do not add new candidate records.

## Remaining By Kind

| kind | remaining |
| --- | ---: |
| food | 15 |
| household | 51 |
| personal | 41 |
| pet | 10 |
| total | 117 |

## Recommended Next Order

1. Generate the remaining 15 food items first. These are closest to the current public Ingredient Atlas promise.
2. Generate low-claim household and personal-care basics next, such as cleaning tools, laundry, storage, hair care, hygiene, and skin care.
3. Keep baby, medicine, supplement, first-aid, and chemical-heavy cleaning items for a stricter pass. Those need extra prompt rules to avoid dosage, safety, medical, or efficacy claims.
4. Generate pet food and pet-care items after food and household basics, with blank packaging or plain product forms only.

## Remaining Food

- `chocolate-bunnies` (Chocolate Bunnies, seasonal sweets)
- `milk-snack-cakes` (Milk Snack Cakes, packaged snack without brand styling)
- `bear-shaped-potato-snacks` (Bear-Shaped Potato Snacks, chips)
- `pomelo` (Pomelo, citrus)
- `sandwich-meat` (Sandwich Meat, deli meat)
- `small-sausages` (Small Sausages, sausages)
- `soup-greens` (Soup Greens, vegetable mix)
- `spring-mix-salad-greens` (Spring Mix Salad Greens, leafy greens)
- `star-sprinkles` (Star Sprinkles, baking decoration)
- `steak-seasoning` (Steak Seasoning, seasoning blend)
- `sweet-popcorn` (Sweet Popcorn, popcorn)
- `taco-seasoning` (Taco Seasoning, seasoning blend)
- `toast` (Toast, bread)
- `trail-mix` (Trail Mix, snack mix)
- `pre-cooked-potatoes` (Pre-Cooked Potatoes, potatoes)

## Remaining Household

- `clothes-disinfectant` (Clothes Disinfectant, laundry)
- `bathroom-spray` (Bathroom Spray, cleaning)
- `diapers` (Diapers, baby)
- `kids-bowls` (Kids Bowls, child care)
- `pacifiers` (Pacifiers, baby)
- `hand-soap` (Hand Soap, cleaning)
- `small-toy` (Small Toy, child care)
- `all-purpose-cleaner` (All-Purpose Cleaner, cleaning)
- `glass-cleaner` (Glass Cleaner, cleaning)
- `toilet-bowl-cleaner` (Toilet Bowl Cleaner, cleaning)
- `disinfecting-wipes` (Disinfecting Wipes, cleaning)
- `disinfectant-spray` (Disinfectant Spray, cleaning)
- `floor-cleaner` (Floor Cleaner, cleaning)
- `wood-polish` (Wood Polish, cleaning)
- `limescale-remover` (Limescale Remover, cleaning)
- `oven-cleaner` (Oven Cleaner, cleaning)
- `dishwasher-tablets` (Dishwasher Tablets, dish care)
- `dishwasher-rinse-aid` (Dishwasher Rinse Aid, dish care)
- `dishwasher-salt` (Dishwasher Salt, dish care)
- `scrub-brushes` (Scrub Brushes, cleaning tools)
- `microfiber-cloths` (Microfiber Cloths, cleaning tools)
- `recycling-bags` (Recycling Bags, storage and bags)
- `sandwich-bags` (Sandwich Bags, storage and bags)
- `plastic-wrap` (Plastic Wrap, kitchen supplies)
- `coffee-filters` (Coffee Filters, kitchen supplies)
- `fabric-softener` (Fabric Softener, laundry)
- `stain-remover` (Stain Remover, laundry)
- `oxygen-bleach` (Oxygen Bleach, laundry)
- `washing-machine-cleaner` (Washing Machine Cleaner, laundry)
- `dryer-sheets` (Dryer Sheets, laundry)
- `lint-roller` (Lint Roller, laundry)
- `clothespins` (Clothespins, laundry)
- `liquid-hand-soap` (Liquid Hand Soap, cleaning)
- `air-freshener` (Air Freshener, home care)
- `drain-cleaner` (Drain Cleaner, cleaning)
- `rubber-gloves` (Rubber Gloves, cleaning tools)
- `mop-heads` (Mop Heads, cleaning tools)
- `broom-refills` (Broom Refills, cleaning tools)
- `dustpan` (Dustpan, cleaning tools)
- `storage-bins` (Storage Bins, storage and bags)
- `baby-wipes` (Baby Wipes, baby)
- `bottle-nipples` (Bottle Nipples, baby)
- `training-pants` (Training Pants, baby)
- `baby-laundry-detergent` (Baby Laundry Detergent, baby)
- `teething-rings` (Teething Rings, baby)
- `bath-toys` (Bath Toys, child care)
- `extension-cord` (Extension Cord, home utility)
- `painter-tape` (Painter Tape, home utility)
- `super-glue` (Super Glue, home utility)
- `packing-tape` (Packing Tape, home utility)
- `zip-ties` (Zip Ties, home utility)

## Remaining Personal

- `cleanser` (Cleanser, skin care)
- `kids-shampoo` (Kids Shampoo, child care)
- `kids-toothpaste` (Kids Toothpaste, child care)
- `night-magnesium` (Night Magnesium, supplements)
- `infant-paracetamol` (Infant Paracetamol, medicine)
- `pigment-cream` (Pigment Cream, skin care)
- `travel-toothpaste` (Travel Toothpaste, oral care)
- `vitamin-c` (Vitamin C, supplements)
- `wax-strips` (Wax Strips, personal care)
- `hand-sanitizer` (Hand Sanitizer, hygiene)
- `conditioner` (Conditioner, hair care)
- `body-wash` (Body Wash, hygiene)
- `bar-soap` (Bar Soap, hygiene)
- `mouthwash` (Mouthwash, oral care)
- `face-wash` (Face Wash, skin care)
- `moisturizer` (Moisturizer, skin care)
- `sunscreen` (Sunscreen, skin care)
- `lip-balm` (Lip Balm, skin care)
- `cotton-pads` (Cotton Pads, personal care)
- `razors` (Razors, personal care)
- `shaving-cream` (Shaving Cream, personal care)
- `hair-gel` (Hair Gel, hair care)
- `hair-ties` (Hair Ties, hair care)
- `feminine-pads` (Feminine Pads, period care)
- `tampons` (Tampons, period care)
- `panty-liners` (Panty Liners, period care)
- `makeup-remover` (Makeup Remover, skin care)
- `nail-clippers` (Nail Clippers, personal care)
- `nail-polish-remover` (Nail Polish Remover, personal care)
- `contact-lens-solution` (Contact Lens Solution, eye care)
- `saline-spray` (Saline Spray, medicine)
- `antiseptic-cream` (Antiseptic Cream, first aid)
- `pain-reliever` (Pain Reliever, medicine)
- `fever-reducer` (Fever Reducer, medicine)
- `thermometer-covers` (Thermometer Covers, medicine)
- `hand-cream` (Hand Cream, skin care)
- `body-lotion` (Body Lotion, skin care)
- `diaper-cream` (Diaper Cream, baby)
- `baby-shampoo` (Baby Shampoo, baby)
- `baby-lotion` (Baby Lotion, baby)
- `child-toothbrushes` (Child Toothbrushes, child care)

## Remaining Pet

- `dental-sticks` (Dental Sticks, pet care)
- `dog-food` (Dog Food, pet food)
- `cat-food` (Cat Food, pet food)
- `cat-litter` (Cat Litter, pet care)
- `dog-treats` (Dog Treats, pet food)
- `cat-treats` (Cat Treats, pet food)
- `pet-shampoo` (Pet Shampoo, pet care)
- `flea-comb` (Flea Comb, pet care)
- `pet-wipes` (Pet Wipes, pet care)
- `aquarium-filter-cartridges` (Aquarium Filter Cartridges, pet supplies)
