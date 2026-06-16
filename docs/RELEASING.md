# Making Changes and Releasing a New Version

This guide explains the full process from scratch. It is written for someone who is new to git, npm packages, and GitHub releases.

The short version is:

1. Get the repo on your machine.
2. Create or update a branch.
3. Make your code changes.
4. Test the package.
5. Bump the package version.
6. Commit and push.
7. Merge into `main`.
8. Create a GitHub Release.
9. Confirm the package was published.

## Important Terms

`dev` is where new work usually happens.

`main` is the release branch. Code on `main` is what should be published.

`package/` is the actual npm package that other apps install.

`harness/` is only the local demo app for testing the package. It is not published.

`package/package.json` contains the package version.

`package-lock.json` also records the package version and must be updated when the version changes.

## 1. Clone the Repo

If you do not already have the repo locally:

```bash
git clone https://github.com/astronautics44/neura-annotation-canvas.git
cd neura-annotation-canvas
```

If you already have the repo, open it:

```bash
cd path/to/neura-annotation-canvas
```

## 2. Install Dependencies

Run this once after cloning, and again whenever dependencies change:

```bash
npm install
```

This installs everything needed for both the package and the harness demo app.

## 3. Start From the Latest `dev`

Before making changes, make sure your local `dev` branch is up to date:

```bash
git checkout dev
git pull origin dev
```

Check that your working tree is clean:

```bash
git status
```

You want to see something like:

```text
nothing to commit, working tree clean
```

If you see modified files that you do not understand, stop and ask before continuing.

## 4. Make Your Changes

Edit the files you need.

Common places:

```text
package/src/components/AnnotationCanvas.tsx   main canvas behavior
package/src/components/Toolbar.tsx            toolbar buttons
package/src/types/canonical.ts                public annotation/tool types
package/src/utils/geometry.ts                 coordinate helpers
harness/app/page.tsx                          local demo page
docs/                                         documentation
```

Do not put client-specific engine adapter logic inside `package/`. Adapters belong in the consuming app. The package should only work with the canonical annotation format.

## 5. Test Locally

Build the package:

```bash
npm run build:pkg
```

If this fails, fix the TypeScript errors before continuing.

To manually test the UI, run the harness:

```bash
npm run dev
```

Open the local URL shown in the terminal, usually:

```text
http://localhost:3000
```

Test the behavior you changed.

For a stronger check, build the harness too:

```bash
npm run build --workspace=harness
```

## 6. Check What Changed

Before committing, review the changed files:

```bash
git status
git diff --stat
```

To inspect the full changes:

```bash
git diff
```

Make sure there are no accidental files, secrets, local tokens, or unrelated changes.

Never commit `.env`, `.npmrc` with a real token, or other secret files.

## 7. Bump the Version

Every release needs a new package version.

The package version lives in:

```text
package/package.json
package-lock.json
```

Use this command to bump the patch version automatically:

```bash
npm version patch --workspace=package --no-git-tag-version
```

Example:

```text
0.1.7 -> 0.1.8
```

Use patch for normal fixes and small features.

Use minor for a larger feature:

```bash
npm version minor --workspace=package --no-git-tag-version
```

Example:

```text
0.1.7 -> 0.2.0
```

After bumping, confirm the version changed:

```bash
git diff -- package/package.json package-lock.json
```

## 8. Build Again After Version Bump

Run the package build again:

```bash
npm run build:pkg
```

This makes sure the release version still builds.

You can also preview what will be published:

```bash
npm pack --workspace=package --dry-run
```

The package should include `dist/` files and `package.json`. It should not include the harness app, local test files, secrets, or node_modules.

## 9. Commit the Changes

Stage the files:

```bash
git add README.md docs package-lock.json package/package.json package/src harness/app/page.tsx
```

If your change did not touch all of those areas, it is okay. Git will only stage files that exist and changed.

Check what is staged:

```bash
git status
```

Commit with a clear message:

```bash
git commit -m "$(cat <<'EOF'
feat: add short description of change

- Explain the main user-facing change.
- Mention important package/API updates.
- Mention docs or release version bump if included.

EOF
)"
```

Example:

```bash
git commit -m "$(cat <<'EOF'
feat: add polyline annotation tool

- Add polyline as a canonical annotation and toolbar tool.
- Support click-to-add drawing with Enter-to-finish guidance.
- Add installation docs and bump package version.

EOF
)"
```

## 10. Push Your Branch

Push `dev`:

```bash
git push origin dev
```

If you used a feature branch instead of `dev`, push that branch:

```bash
git push -u origin your-branch-name
```

## 11. Merge `dev` Into `main`

When the change is ready to release, merge it into `main`.

First update `main`:

```bash
git checkout main
git pull origin main
```

Merge `dev`:

```bash
git merge dev --no-edit
```

Build one more time on `main`:

```bash
npm run build:pkg
```

Push `main`:

```bash
git push origin main
```

## 12. Create a GitHub Release

Publishing happens through the GitHub workflow named `Publish Package`.

That workflow runs automatically when a GitHub Release is published.

Go to GitHub:

```text
Repo -> Releases -> Draft a new release
```

Use a tag that matches the package version.

If `package/package.json` says:

```json
"version": "0.1.8"
```

Use this tag:

```text
v0.1.8
```

Release title:

```text
v0.1.8
```

Release notes can be simple:

```text
## Changes
- Added polyline annotation support.
- Added install and release documentation.
- Bumped package version to 0.1.8.
```

Click:

```text
Publish release
```

## 13. Confirm the Publish Worked

After publishing the release, check:

```text
Repo -> Actions -> Publish Package
```

The workflow should be green.

The workflow does these steps:

1. Checks out the repo.
2. Installs dependencies with `npm ci`.
3. Builds the package.
4. Publishes `package/` to GitHub Packages.

If it fails, open the failed workflow and read the red error message.

Common causes:

- Version already exists. Bump to a new version and release again.
- Package permissions are not configured.
- Build failed because of a TypeScript error.
- The release was created from the wrong branch or commit.

## 14. Install the New Version in Another App

In the app that uses the package:

```bash
npm install @astronautics44/neura-annotation-canvas@0.1.8
```

Replace `0.1.8` with the version you released.

Then run the app and confirm the new behavior is present.

## 15. Beginner Checklist

Before release:

- `git status` only shows the files you expect.
- `npm run build:pkg` passes.
- `npm run build --workspace=harness` passes if UI behavior changed.
- `package/package.json` has a new version.
- `package-lock.json` has the same new version.
- No secrets or local config files are included.
- Changes are committed and pushed.
- `main` contains the release commit.

After release:

- GitHub Release tag matches the package version, for example `v0.1.8`.
- `Publish Package` workflow is green.
- Consumer app can install the new version.
- Consumer app shows the expected new behavior.

## Emergency Notes

Do not reuse a package version that was already published. Package versions are immutable.

If a release is bad, make a fix, bump to a newer version, and release again.

Do not force-push `main`.

Do not commit real tokens.

