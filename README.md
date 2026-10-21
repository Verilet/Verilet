# Detect-Housing-Scam

Web application to detect fraudulent housing and rental listings by evaluating risk indicators, price deviations, and listing metadata.

## Tech Stack

| Layer              | Technology                         | Purpose                                          |
| ------------------ | ---------------------------------- | ------------------------------------------------ |
| Frontend           | React 19, TypeScript, Vite         | User interface and manual scan workflows         |
| Backend            | Node.js 22, Express 5, TypeScript  | API routing and orchestration                    |
| Database           | MongoDB, Mongoose                  | Caching scanned listings and analysis results    |
| Scraping           | Cheerio                            | Extracting listing content from web pages        |
| Validation         | Zod                                | Runtime schema validation for forms and payloads |
| Quality & Testing  | Vitest, ESLint, Prettier           | Unit/API tests, static analysis, code formatting |
| Automation         | Husky, lint-staged, GitHub Actions | Pre-commit quality hooks, continuous integration |
| Project Management | Jira, Figma                        | Scrum task tracking, UI design and flows         |

## Setup

Requires Node 22 (pinned in `.nvmrc`).

```bash
# Install root tooling (Husky pre-commit hooks)
npm ci

# Install client and server dependencies
npm --prefix client ci
npm --prefix server ci

# Configure local environment files
cp server/.env.example server/.env
cp client/.env.example client/.env
```

## Project Structure

```text
Detect-Housing-Scam/
├── client/                     # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── assets/             # Static graphics and icons
│   │   ├── App.tsx             # Root React component
│   │   └── App.test.tsx        # Client unit tests
│   └── .env.example            # Frontend environment template
├── server/                     # Express REST API (Node 22 + TypeScript)
│   ├── src/
│   │   ├── config/             # App & database configuration (MongoDB connection)
│   │   ├── controllers/        # Request handlers (HTTP status codes, responses)
│   │   ├── models/             # Mongoose schemas and data models
│   │   ├── routes/             # Express route definitions
│   │   ├── services/           # Business logic and external API integrations
│   │   ├── app.ts              # Express app configuration & middleware
│   │   └── index.ts            # Server entry point & startup lifecycle
│   └── .env.example            # Backend environment template
├── docs/                       # Specifications and architecture docs
└── .github/workflows/          # CI and CD GitHub Actions pipelines
```

## Development

Run the frontend and backend in separate terminals:

```bash
# Frontend (runs on http://localhost:5173)
npm --prefix client run dev

# Backend (runs on http://localhost:5000)
npm --prefix server run dev
```

The backend health check is accessible at `http://localhost:5000/api/health`.

## Testing & Linting

Tests are run using Vitest. Test files reside adjacent to the source modules they test (`*.test.tsx` or `*.test.ts`).

```bash
# Run test suites
npm --prefix client test
npm --prefix server test

# Linting and formatting
npm --prefix client run lint
npm --prefix server run lint
npx prettier --write "client/src/**/*.{ts,tsx}" "server/src/**/*.ts"
```

## Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md): Branch naming, Jira linkage, commit format, and PR rules.
- [docs/ci-cd.md](./docs/ci-cd.md): Detailed CI/CD workflow mechanics, job breakdowns, and troubleshooting.
- [AGENTS.md](./AGENTS.md): Operational boundaries and constraints for AI coding assistants.
