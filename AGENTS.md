# Agent Guidelines

Context and operational rules for AI coding assistants working in this repository.

## Mandatory Documentation Review

Before designing, implementing, or testing features, agents **MUST consult the `docs/` directory** for repository context and invariants:

- **[`docs/architecture.md`](./docs/architecture.md)**: System architecture, component boundaries, 3-tier scraper data flows, and design invariants.
- **[`docs/ci-cd.md`](./docs/ci-cd.md)**: Git hooks, branch naming conventions, PR validation workflows, and CD pipelines.
- **[`docs/tasks/`](./docs/tasks/)**: CSE 115A sprint task specifications, criteria mapping, and past task examples.

## Repository Overview

Monorepo architecture with two main packages:

- `client/`: React 19 frontend built with Vite and TypeScript (tests in `client/tests/`).
- `server/`: Express 5 REST API built with Node.js and TypeScript (tests in `server/tests/`).

### Server Directory Structure (`server/src/`)

- `config/`: Configuration modules and database connection lifecycle (`database.ts`).
- `controllers/`: HTTP request handlers responsible for parsing parameters and formatting responses.
- `models/`: Mongoose schemas and data persistence models.
- `routes/`: Express route definitions, aggregated into `routes/index.ts` and mounted at `/api`.
- `services/`: Business logic, third-party API integrations, and web scrapers.
- `app.ts`: Express application setup, middleware, and route mounting (no network binding, safe for Supertest).
- `index.ts`: Application entry point; connects to MongoDB and starts the HTTP server.

Key dependencies:

- Validation: Zod schemas for form inputs, scraper outputs, and API payloads.
- Scraping: Cheerio for static HTML extraction from listing sources.
- Database: MongoDB via Mongoose (ODM).
- Testing: Vitest for client unit tests (`client/tests/`) and server endpoint tests (`server/tests/`).
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
cp server/.env.example server/.env
cp client/.env.example client/.env

# Local dev servers
npm --prefix client run dev # React app: http://localhost:5173
npm --prefix server run dev # Express API: http://localhost:5000

# Testing
npm --prefix client test # Client unit tests (Vitest in client/tests/)
npm --prefix server test # Server API tests (Vitest in server/tests/)

# Linting
npm --prefix client run lint # Client ESLint
npm --prefix server run lint # Server ESLint

# Formatting (Prettier)
npx prettier --write "client/src/**/*.{ts,tsx,js,jsx}" "server/src/**/*.{ts,js}" "*.{json,md,yml,yaml}"
```

## Architectural Guidelines and Invariants

1. Spec-driven development:
   - Review or create interface specifications under `docs/specs/` before writing route handlers, services, or data models.
   - Do not implement ad-hoc request formats without corresponding Zod schemas.

2. Backend patterns (`server/src/`):
   - Keep controllers, route definitions, and service logic separate across their designated directories (`controllers/`, `routes/`, `services/`, `models/`).
   - Do not invoke `connectDatabase()` or `app.listen()` inside `app.ts` or route files; server startup and database lifecycle are strictly managed in `index.ts` to keep `app.ts` testable in-memory.
   - All API endpoints must be declared in modular routers within `routes/` and registered through `routes/index.ts` under `/api`.
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

## CSE 115A Sprint Task Rules

When working on sprint tasks submitted to the CSE 115A Repo Metrics app:

1. **Spec Committed Alone First (Process Point):**
   - The task spec file `docs/tasks/sprint-N/<task-id>.md` **MUST be committed alone in the very first commit on the branch** before any implementation code or tests are created.
   - No code or test files may be staged or included in that initial commit.
   - Tag that initial commit with `<task-id>-base` (e.g. `US-1-T-1-base`).

2. **Branch Naming:**
   - Use `task/<task-id>` (e.g. `task/US-1-T-1` or `task/SCRUM-3-T-1`).

3. **Commit Messages:**
   - Spec commit: `<task-id>: task spec` (e.g. `US-1-T-1: task spec` or `SCRUM-3-T-1: task spec`).
   - Implementation commits: `<task-id>: <summary>` (e.g. `US-1-T-1: implement login rejection check`).

4. **Pull Request Rules:**
   - PR Title: `<task-id>: <title>` (e.g. `US-1-T-1: Reject a non-university email on login`).
   - Within `docs/tasks/`, the PR must touch **exactly one file**: `docs/tasks/sprint-N/<task-id>.md`.

5. **Test Mapping Invariant:**
   - Every numbered criterion under `## Acceptance criteria` in the spec must have a corresponding entry in the `## Tests` table and a real passing test file.
   - Never weaken, bypass, or delete a test to force implementation to pass.

## Git and Contribution Rules

Two valid branch and commit formats are supported:

- **Format 1: Team Infrastructure & Tooling**
  - Branch: `<type>/SCRUM-<number>-short-description` (e.g. `feat/SCRUM-12-url-input-form`).
  - Commit message: `<type>(<scope>): <summary>` (e.g. `feat(client): add scanner form`).
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`.

- **Format 2: CSE 115A Sprint Tasks**
  - Branch: `task/<task-id>` (e.g. `task/US-1-T-1` or `task/SCRUM-3-T-1`).
  - Commit message: `<task-id>: <summary>` (e.g. `US-1-T-1: task spec`).
  - PR Title: `<task-id>: <title>`.

General repository rules:

- Automated pre-commit hook runs `lint-staged`. Do not bypass with `--no-verify` unless explicitly instructed.
- Never commit `.env`, `.env.local`, or files in `dist/`.
- Do not install packages in the root directory unless they are workspace-wide dev tooling. Client packages belong in `client/package.json`; server packages belong in `server/package.json`.
