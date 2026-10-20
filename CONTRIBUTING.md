# Contributing

Welcome! We’re excited to have you here and appreciate your contributions to **Detect-Housing-Scam**. As a contributor, here are the guidelines we follow:

- [Development Setup](#setup)
- [Submission Guidelines](#submit)
- [CSE 115A Sprint Task Workflow](#cse115a)
- [Coding Rules](#rules)
- [Commit Message Format](#commit)

## <a name="setup"></a> Setup and Development

### <a name="prereqs"></a> Prerequisites

Before you can build and run Detect-Housing-Scam, you must install and configure the following on your development machine:

- [Git](https://git-scm.com/) and/or the [**GitHub Desktop app**](https://desktop.github.com/); [GitHub's Guide to Installing Git](https://help.github.com/articles/set-up-git) is a good source of information.
- [Node.js](https://nodejs.org) (version 22, specified in [`.nvmrc`](./.nvmrc)), which is used to run the development servers, execute tests, and build production bundles. `.nvmrc` is read by [nvm](https://github.com/nvm-sh/nvm) commands like `nvm install` and `nvm use`.

### <a name="sources"></a> Getting the Sources

Clone the repository:

```shell
# Clone the GitHub repository:
git clone https://github.com/ypeng64/Detect-Housing-Scam
cd Detect-Housing-Scam
```

### <a name="npm"></a> Installing NPM Modules

Install the dependencies across the root workspace, client, and server using clean install (`npm ci`):

```shell
# Install root tooling (Husky & lint-staged)
npm ci

# Install frontend and backend dependencies
npm --prefix client ci
npm --prefix server ci
```

### <a name="building"></a> Running the Project Locally

Run the frontend and backend in separate terminals:

```shell
# Start the React frontend (accessible at http://localhost:5173/)
npm --prefix client run dev

# Start the Express backend (accessible at http://localhost:5000/)
npm --prefix server run dev
```

You can verify the backend health check at `http://localhost:5000/api/health`.

### <a name="testing-the-application"></a> Testing the Application

We use **Vitest** for unit and API testing across the client and server. Place new test files alongside the code they test (`*.test.tsx` or `*.test.ts`).

```shell
# Run frontend unit tests
npm --prefix client test

# Run backend API tests
npm --prefix server test
```

## <a name="submit"></a> Submission Guidelines

### <a name="submit-issue"></a> Submitting an Issue or Task

All user stories, sprint tasks, and bugs are tracked on our [**Jira Scrum Board**](https://slugsafe.atlassian.net). Before starting work, ensure there is a corresponding `SCRUM-XX` ticket on the board assigned to you.

### <a name="submit-pr"></a> Submitting a Pull Request (PR)

Before you submit your Pull Request (PR), follow these steps:

1. Check GitHub for any open or closed PR that relates to your submission so we don't duplicate efforts.
2. Create a new branch matching either accepted convention:
   - **Team Infrastructure & General Features:** `<type>/SCRUM-<number>-<description>`
     ```shell
     git checkout -b feat/SCRUM-12-url-scanner-form
     ```
   - **CSE 115A Sprint Tasks:** `task/<task-id>`
     ```shell
     git switch -c task/US-1-T-1
     ```
3. Make your changes and follow our [Coding Rules](#rules).
4. Commit your changes using an accepted commit format:
   - **Conventional Commits:** `git commit -m "feat(client): add url scanner input form"`
   - **Sprint Tasks:** `git commit -m "US-1-T-1: task spec"`
5. Push your branch to GitHub:
   ```shell
   git push -u origin feat/SCRUM-12-url-scanner-form
   ```
6. Open a Pull Request targeting `main` and complete the PR template.

## <a name="cse115a"></a> CSE 115A Sprint Task Workflow

For graded sprint tasks submitted to the Repo Metrics app, follow this exact sequence to protect your **Process point**:

1. **Write the task spec:** Create `docs/tasks/sprint-N/<task-id>.md` (with Front Matter, Description, Specs, Requirements, Acceptance criteria, Tests).
2. **Branch from main:** `git switch -c task/US-1-T-1`
3. **Commit the spec ALONE (no code):**
   ```bash
   git add docs/tasks/sprint-1/US-1-T-1.md
   git commit -m "US-1-T-1: task spec"
   ```
4. **Tag the base commit before writing any code:**
   ```bash
   git tag US-1-T-1-base
   git push origin task/US-1-T-1 US-1-T-1-base
   ```
5. **Implement and test:** Write the implementation and test files on the branch.
6. **Open PR:** Title must be `<task-id>: <title>` (e.g. `US-1-T-1: Reject a non-university email on login`). Within `docs/tasks/`, only your task spec file may be changed.
7. **Merge and tag done:** After CI passes and teammates review:
   ```bash
   git fetch origin
   git tag US-1-T-1-done <merge-commit-sha>
   git push origin US-1-T-1-done
   ```
8. **Submit in Repo Metrics App:** Paste the merged PR link into your assignment card.

## <a name="rules"></a> Coding Rules

To ensure consistency throughout the source code, keep these rules in mind as you are working:

- All new features or bug fixes should include corresponding tests (`*.test.tsx` or `*.test.ts`).
- Code formatting is enforced automatically on commit via **Husky** and **Prettier** (100-character line width, single quotes, semicolons).
- All code must pass **ESLint** (`npm --prefix client run lint` and `npm --prefix server run lint`) with zero errors.

## <a name="commit"></a> Commit Message Format

Two commit formats are supported by Husky and CI:

### 1. Conventional Commits (Team / Infrastructure)

Format: `<type>(<scope>): <short summary>`

- **Allowed Types:** `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `style`, `test`, `revert`.
- **Optional Scopes:** `client`, `server`, `scanner`, `results`, `api`, `db`.
- **Example:** `feat(client): add url scanner input form`

### 2. Course Sprint Tasks

Format: `<task-id>: <short summary>`

- **Example:** `US-1-T-1: task spec`
- **Example:** `US-1-T-1: implement non-university email check`
