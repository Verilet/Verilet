# Detect-Housing-Scam

Web app to detect fraudulent housing and rental listings.

## Setup

Requires Node 22 (`.nvmrc`).

```bash
# Install root tooling (Husky pre-commit hooks)
npm ci

# Install client and server dependencies
npm --prefix client ci
npm --prefix server ci
```

## Development

Run the frontend and backend in separate terminals:

```bash
# Frontend (runs on http://localhost:5173)
npm --prefix client run dev

# Backend (runs on http://localhost:5000)
npm --prefix server run dev
```

The backend health check is at `http://localhost:5000/api/health`.

## Testing & Linting

Tests use Vitest. Place new test files alongside the code they test (`*.test.tsx` or `*.test.ts`).

```bash
# Run tests
npm --prefix client test
npm --prefix server test

# Linting and formatting
npm --prefix client run lint
npm --prefix server run lint
npx prettier --write "client/src/**/*.{ts,tsx}" "server/src/**/*.ts"
```

## Contributing & CI

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branching, commit conventions, and pull request rules. GitHub Actions automatically validates branch names, PR titles, linting, tests, and builds on all pull requests to `main` and `develop`.
