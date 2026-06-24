# Reddit r/datasets

Asset to attach: `launch/assets/ingredient-atlas-contact-sheet.png`

Timing: Post after public release and only if subreddit rules allow it.

What not to do: Do not sound like a launch ad. Do not repost repeatedly.

Reply strategy: Ask for dataset feedback and corrections.


Title:

I made a CC0 ingredient image and metadata dataset for recipe apps

Body:

I made Ingredient Atlas because recipe and grocery apps often need clean ingredient images, but most food datasets are built for dish classification, packaged products, or nutrition research.

This is meant to be more app-facing:

- 1,673 ingredient records
- 5,019 image files
- WebP thumbnails and PNG fallbacks
- slugs, aliases, categories, checksums, review status
- Hugging Face files plus a small npm resolver

The images are AI-generated and reviewed on a best-effort basis. Nutrition metadata is best-effort too, so it should not be used as medical or dietary advice.

I would love feedback on bad ingredient forms, missing aliases, and whether the metadata shape is useful for app builders.

Links:

- Dataset: https://huggingface.co/datasets/ionicam/ingredient-atlas
- Repo: https://github.com/ionmesca/ingredient-atlas
