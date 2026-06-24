# Launch Research

This is the short source note that guided the launch prep.

## Sources And Decisions

- GitHub best practices for repositories: https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories
  - Decision: keep GitHub focused on code, docs, issue templates, launch assets, and contributor paths. Keep full dataset binaries on Hugging Face.
- GitHub community profile docs: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories
  - Decision: add README, license, contributing, code of conduct, security notes, issue templates, and pull request template.
- Open Source Guides: https://opensource.guide/starting-a-project/
  - Decision: explain why the project exists, what help is useful, and how people can contribute.
- npm scoped public package docs: https://docs.npmjs.com/creating-and-publishing-scoped-public-packages
  - Decision: prepare the unscoped package because `ingredient-atlas` is currently available, but document `@ionmesca/ingredient-atlas` as the fallback.
- npm provenance docs: https://docs.npmjs.com/generating-provenance-statements/
  - Decision: include a disabled GitHub Actions example for trusted publishing and provenance, but do not activate it yet.
- Hugging Face dataset card docs: https://huggingface.co/docs/hub/datasets-cards
  - Decision: keep the dataset card simple, include license metadata, AI disclosure, limitations, and contact.
- Gemini API Additional Terms: https://ai.google.dev/gemini-api/terms
  - Decision: Google does not claim ownership of generated content, but the public materials still disclose AI generation and keep a correction path.
- Google Cloud Service Specific Terms for Generative AI: https://cloud.google.com/terms/service-terms
  - Decision: do not make legal guarantees about generated images. Use a clear CC0 direction, practical limitations, and a takedown policy.
- Hacker News Show HN guide: https://news.ycombinator.com/showhn.html
  - Decision: use a plain Show HN title and add a first comment with technical details and limitations.
- Product Hunt launch guide: https://www.producthunt.com/launch
  - Decision: prepare Product Hunt assets, but treat it as optional because this is mostly a developer/data utility.
- Reddit rules: https://redditinc.com/policies/reddit-rules
  - Decision: be transparent that it is my project, post only where rules allow, ask for feedback, and do not spam.
- Data Is Plural: https://www.data-is-plural.com/
  - Decision: prepare a short submission focused on why the dataset is useful and what makes it different.

## Similar Project Read

- Food-101 is a dish classification dataset. Ingredient Atlas is for ingredient-level app assets.
- Open Food Facts is a product and packaging database. Ingredient Atlas is not a product database.
- Recipe1M is a recipe and dish-image research dataset. Ingredient Atlas is a practical ingredient image and metadata layer.
- Roboflow-style datasets often focus on object detection or model training. Ingredient Atlas focuses on app UI and hosted files.
