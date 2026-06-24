# Reddit r/webdev

Asset to attach: `launch/assets/how-to-use.png`

Timing: Only post if the rules allow project sharing. r/datasets is higher priority.

What not to do: Do not frame it as promotion. Keep it useful for builders.

Reply strategy: Answer implementation questions and point to the demo.


Title:

I made a small ingredient image dataset for recipe and grocery app builders

Body:

I built Ingredient Atlas for a practical web/app problem: if you are making a recipe, grocery, pantry, or meal-planning app, you probably need ingredient thumbnails and stable ingredient metadata.

It is not an API. It is downloadable files on Hugging Face plus a small npm resolver.

```js
import { getIngredientImage } from "ingredient-atlas"

const image = getIngredientImage("garlic", {
  baseUrl: "https://huggingface.co/datasets/ionicam/ingredient-atlas/resolve/main",
})
```

The images are AI-generated and reviewed on a best-effort basis. The project is open to corrections.

Repo: https://github.com/ionmesca/ingredient-atlas
npm: https://www.npmjs.com/package/ingredient-atlas
