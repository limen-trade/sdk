# Repository Guidelines

The Limen SDK wraps authentication, token storage, and Solana-powered payment flows. Use this guide to keep contributions consistent, predictable, and easy to review.

## Project Structure & Module Organization
- `src/` holds all TypeScript sources; key entry points include `src/client.ts` for the public SDK surface, `src/auth.ts` for authentication helpers, and `src/payment.ts` for transaction orchestration.
- Build artifacts land in `dist/` after compilation—never hand-edit or commit generated files.
- Re-export new modules through `src/index.ts` so the package surface stays coherent, and prefer one domain per file using the existing kebab-case naming pattern (e.g., `token-store.ts`).

## Build, Test, and Development Commands
- `pnpm install` installs dependencies using the repository’s locked PNPM version.
- `pnpm build` compiles TypeScript with the strict settings in `tsconfig.json` and emits ESM output in `dist/`.
- `pnpm lint` runs ESLint on `src/`; lint must pass before opening a PR.

## Coding Style & Naming Conventions
- TypeScript code uses 2-space indentation, ESM imports, and explicit return types for exported functions and classes.
- Use camelCase for functions and variables, PascalCase for classes and types, and kebab-case for filenames.
- Surface errors with descriptive `Error` messages similar to the existing guard clauses, and avoid side effects at module load time.

## Testing Guidelines
- No automated test runner ships with the SDK yet; include targeted tests alongside new features (e.g., under `src/__tests__/`) and document how to execute them in the PR.
- At a minimum, run `pnpm build` to ensure type-checking succeeds, and verify authentication or payment flows against a local or staging Limen API before submission.

## Commit & Pull Request Guidelines
- Use concise, imperative Conventional Commit-style messages (`feat: add payment signer`, `fix: handle auth refresh`) so future changelog automation is straightforward.
- Reference related issues in the commit body or PR description, list reproduction steps, and include screenshots or CLI transcripts for behavior changes.
- Every PR should state the verification steps you ran (`pnpm build`, manual wallet auth check, etc.) and call out any follow-up work needed.

## Security & Configuration Tips
- Never commit Solana secret keys or JWTs; load credentials from environment variables or secure storage in your tests.
- When documenting examples, default to the production API endpoint (`https://api.limen.trade`) and clearly mark anything that targets alternative environments.
