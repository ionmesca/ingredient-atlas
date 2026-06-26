# Publishing Runbook

This is the final checklist for public launch. Do not skip the approval boxes.

## 1. Final Local Checks

In the private source workspace, before changing public visibility:

```bash
npm install
node scripts/validate-dataset.mjs
node scripts/build-public-export.mjs
node scripts/validate-public-export.mjs
node scripts/create-launch-materials.mjs
node scripts/validate-metadata.mjs
node scripts/analyze-visual-risk.mjs
npm audit
npm pack --dry-run
npm run smoke
```

Run safety scans:

```bash
rg -n "<token and private-field patterns>" .
rg -n "\x{2014}" README.md docs launch .github CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md CHANGELOG.md LICENSE-DATA.md
```

## 2. Hugging Face Public Release

Current repo:

https://huggingface.co/datasets/ionicam/ingredient-atlas

Approval:

- [ ] I approve Hugging Face public visibility.

After approval, use the Hugging Face UI to change visibility from private to public.

Then verify:

- the dataset is public;
- `README.md` renders correctly;
- `metadata.jsonl` and images are visible;
- `docs/TAKEDOWN_POLICY.md` lists hello@ionmesca.com;
- the dataset card says images are AI-generated;
- the license is CC0-1.0.

## 3. GitHub Public Release

Approval:

- [ ] I approve GitHub public visibility.

After approval:

```bash
gh repo edit ionmesca/ingredient-atlas --visibility public
git tag v0.1.2
git push origin v0.1.2
gh release create v0.1.2 --title "Ingredient Atlas v0.1.2" --notes-file launch/platforms/github-release-notes.md
```

## 4. npm Publish

Approval:

- [ ] I approve npm publish.

Then:

```bash
npm whoami
npm publish
```

After publish:

```bash
npm view ingredient-atlas version
npm install ingredient-atlas
```

## 5. Launch Posts

Approval:

- [ ] I approve launch posts.

Suggested sequence:

1. Hugging Face public.
2. GitHub public.
3. npm publish.
4. GitHub release.
5. Show HN.
6. r/datasets.
7. Hugging Face community post.
8. direct outreach to a small batch of relevant builders.

## 6. Monitor

Watch:

- GitHub issues;
- Hugging Face discussions;
- npm package page;
- HN comments;
- Reddit comments;
- direct replies.

Reply with specifics. Thank people for corrections. Keep a small changelog of fixes.

## Rollback

If something serious is wrong:

- set Hugging Face back to private if needed;
- unpublish or deprecate npm only if absolutely necessary;
- archive or hide a launch post only if it points to harmful or private data;
- publish a short correction rather than pretending nothing happened.
