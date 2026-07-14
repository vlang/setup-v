# Contributing to Setup V

Thanks for your interest in improving `setup-v`! This document explains how to
get started.

## Development setup

You will need [Node.js](https://nodejs.org) (version 24 or later) and npm.

```bash
npm ci
npm run build      # compile TypeScript to lib/ (type-check)
npm run package    # bundle src/ into the committed dist/index.js via ncc
npm run lint       # eslint
npm run test       # vitest
npm run all        # build + format + lint + package + test
```

## Project layout

- `src/` — TypeScript source (action entry point, installer, helpers).
- `dist/index.js` — the bundled output that GitHub Actions actually runs.
  It is committed on purpose; rebuild it with `npm run package` after any
  change to `src/` and include the regenerated `dist/` in your PR.
- `.github/workflows/` — CI (`ci.yml`) and the `dist` consistency check
  (`check-dist.yml`).

## Pull requests

1. Fork the repository and create a feature branch from `main`.
2. Make your change, keeping the scope focused (one concern per PR).
3. Run `npm run all` and make sure lint, tests, and the `dist` build pass.
4. Commit `dist/index.js` (and its map) whenever you change `src/`.
5. Open the PR with a clear description and reference any related issue
   (e.g. `Closes #123`).

## Reporting issues

- For bugs and feature requests, open a [GitHub issue](https://github.com/vlang/setup-v/issues).
- For security vulnerabilities, follow the policy in
  [SECURITY.md](./SECURITY.md) and report privately — do not open a public issue.

## Code style

Code is formatted with Prettier and linted with ESLint
(`eslint-plugin-github`). Run `npm run format` before committing.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
