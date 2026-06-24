# Hacker News Show HN

Asset to attach: `launch/assets/social-preview.png`

Timing: Post after Hugging Face, GitHub, and npm are live.

What not to do: Do not ask for upvotes. Do not oversell it.

Reply strategy: Answer technical questions directly. Thank people who point out bad images or metadata.


Title:

Show HN: Ingredient Atlas, CC0 ingredient images and metadata for recipe apps

URL:

https://github.com/ionmesca/ingredient-atlas

First comment:

I made this because I kept running into a boring problem while working on recipe software: ingredient images are useful, but clean reusable ones are hard to source.

Ingredient Atlas is a public dataset of 1,673 ingredient records and 5,019 image files. It has stable slugs, aliases, categories, checksums, a Hugging Face dataset, and a small npm resolver package.

The images are AI-generated and reviewed on a best-effort basis. It is not perfect. The point of v0 is to make a useful baseline that people can correct and extend.

It is different from Food-101 or Recipe1M because it is not a dish classification dataset. It is meant for app UI: recipe cards, grocery lists, pantry tools, and meal planners.

I would especially like feedback on bad ingredient forms, missing common aliases, and whether the package API is useful.
