# Agent Guidelines

Context and operational rules for AI coding assistants working in this repository.

## Repository Overview

Monorepo architecture with two main packages:

- `client/`: React 19 frontend built with Vite and TypeScript.
- `server/`: Express 5 REST API built with Node.js and TypeScript.

Key dependencies:

- Validation: Zod schemas for form inputs, scraper outputs, and API payloads.
- Scraping: Cheerio for static HTML extraction from listing sources.
- Database: MongoDB via Mongoose (ODM).
- Testing: Vitest for client unit tests and server endpoint tests.
- Code style: ESLint and Prettier, coordinated with `eslint-config-prettier`.
- Git hooks: Husky running `lint-staged` on pre-commit.

Node version: 22 (pinned in `.nvmrc`).

## Development Commands

Always run commands targeting the appropriate workspace prefix:

```bash
# Setup
npm ci
npm --prefix client ci
npm --prefix server ci

# Local dev servers
npm --prefix client run dev     # React app: http://localhost:5173
npm --prefix server run dev     # Express API: http://localhost:5000

# Testing
npm --prefix client test        # Client unit tests (Vitest)
npm --prefix server test        # Server API tests (Vitest)

# Linting
npm --prefix client run lint    # Client ESLint
npm --prefix server run lint    # Server ESLint

# Formatting (Prettier)
npx prettier --write "client/src/**/*.{ts,tsx,js,jsx}" "server/src/**/*.{ts,js}" "*.{json,md,yml,yaml}"
```

## Architectural Guidelines and Invariants

1. Spec-driven development:
   - Review or create interface specifications under `docs/specs/` before writing route handlers, services, or data models.
   - Do not implement ad-hoc request formats without corresponding Zod schemas.

2. Backend patterns (`server/src/`):
   - Keep controllers, route definitions, and service logic separate.
   - Every POST/PUT endpoint must parse and validate `req.body` using a Zod schema before business logic executes.
   - Return predictable JSON response envelopes:
     - Success: `{ "success": true, "data": ... }`
     - Error: `{ "success": false, "error": "Clear description", "details": ... }`
   - External APIs (such as HUD Fair Market Rent or property assessor services) must reside inside a dedicated `services/` module with timeout handling and fallback defaults.

3. Frontend patterns (`client/src/`):
   - Use TypeScript functional components and standard React hooks.
   - Validate form state with Zod before dispatching network calls.
   - Handle loading, empty, and error states explicitly in UI components.

4. Type safety:
   - TypeScript strict mode is enabled. Do not use `any` unless strictly required for third-party compatibility; prefer `unknown` with type narrowing.
   - Shared data contracts should be typed via Zod inference (`z.infer<typeof schema>`).

## Git and Contribution Rules

- Branch naming: `<type>/SCRUM-<number>-short-description` (e.g. `feat/SCRUM-12-url-input-form`).
- Commit message format: Follow Conventional Commits: `<type>(<scope>): <short summary>`.
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`.
  - Scopes: `client`, `server`, `scanner`, `results`, `api`, `db`.
  - Summary: Lowercase, present imperative tense, no period at end.
  - Footer: Reference the Jira ticket, e.g. `Fixes SCRUM-XX`.
- Automated pre-commit hook runs `lint-staged`. Do not bypass with `--no-verify` unless explicitly instructed.
- Never commit `.env`, `.env.local`, or files in `dist/`.
- Do not install packages in the root directory unless they are workspace-wide dev tooling (e.g., hooks, formatters). Client packages belong in `client/package.json`; server packages belong in `server/package.json`.
