# npm Publishing

Do not publish until the owner approves it.

## Package Name

Recommended package name: `ingredient-atlas`

Why:

- it is short and easy to remember;
- it matched the project name at the time of the availability check;
- app developers can install it without a scope.

Fallback if the name is taken before launch: set the package name to `@ionmesca/ingredient-atlas`, then publish it as a public scoped package.

```bash
npm publish --access public
```

with package name:

```json
"name": "@ionmesca/ingredient-atlas"
```

## Before Publishing

```bash
npm whoami
npm install --package-lock-only
npm audit
npm pack --dry-run
npm run smoke
```

Check the tarball contents. It should include only:

- `src/`
- `data/manifest.compact.json`
- `README.md`
- `LICENSE`
- `LICENSE-DATA.md`
- `package.json`

It should not include:

- `dataset/`
- `public-dataset/`
- `reviews/`
- `launch/`
- `.env`
- Hugging Face tokens
- generated private artifacts

## Publish Command

Unscoped package:

```bash
npm publish
```

Scoped fallback:

```bash
npm publish --access public
```

## Provenance

Best path after the GitHub repo is public:

- configure npm trusted publishing;
- use GitHub Actions with OIDC;
- publish with `npm publish --provenance`;
- do not store npm tokens in the repo.

The workflow example is saved as:

```text
.github/workflows/npm-publish.yml.disabled
```

It is intentionally disabled.

## Approval

- [ ] I approve npm package name `ingredient-atlas`.
- [ ] I approve npm publish.
- [ ] I approve trusted publishing setup.
