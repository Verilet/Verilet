# Contributing

Welcome! We’re excited to have you here and appreciate your contributions to **Detect-Housing-Scam**. As a contributor, here are the guidelines we follow:

- [Development Setup](#setup)
- [Submission Guidelines](#submit)
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

# Go to the directory:
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
2. Create a new branch using a descriptive prefix (`build/`, `chore/`, `ci/`, `docs/`, `feat/`, `fix/`, `perf/`, `refactor/`, `style/`, `test/`) and your Jira ticket number (`SCRUM-XX`):

   ```shell
   git checkout -b feat/SCRUM-12-short-description
   ```

3. Make your changes and follow our [Coding Rules](#rules).
4. Commit your changes using a descriptive commit message that follows our [commit message conventions](#commit):

   ```shell
   git commit -m "feat(client): add url scanner input form"
   ```

5. Push your branch to GitHub:

   ```shell
   git push -u origin feat/SCRUM-12-short-description
   ```

6. In GitHub, open a Pull Request targeting `main` (or `develop`) and complete the PR template, including `Fixes SCRUM-XX` so Jira automatically links your PR.

### <a name="review-pr"></a> Reviewing a Pull Request

All Pull Requests require all GitHub Actions CI checks (`Lint & Format`, `Client`, and `Server`) to pass green and at least one teammate review before merging.

#### Addressing Review Feedback

If a teammate requests changes on your PR:

1. Make the required updates to the code.
2. Commit and push the updates to your branch (this will automatically update your Pull Request and re-run CI):

   ```shell
   git add .
   git commit -m "fix(client): address pr review feedback"
   git push
   ```

##### <a name="update-commit"></a> Updating the Last Commit Message

If you need to fix the commit message of your most recent commit:

1. Amend the last commit message:

   ```shell
   git commit --amend
   ```

2. Push safely to your branch:

   ```shell
   git push --force-with-lease
   ```

#### <a name="pr-merge"></a> After Your Pull Request Is Merged

After your pull request is merged, delete your feature branch and pull the latest changes:

```shell
# Switch back to main
git checkout main

# Delete local feature branch
git branch -d feat/SCRUM-12-short-description

# Pull latest changes
git pull origin main
```

## <a name="rules"></a> Coding Rules

To ensure consistency throughout the source code, keep these rules in mind as you are working:

- All new features or bug fixes should include corresponding tests (`*.test.tsx` or `*.test.ts`).
- Code formatting is enforced automatically on commit via **Husky** and **Prettier** (100-character line width, single quotes, semicolons).
- All code must pass **ESLint** (`npm --prefix client run lint` and `npm --prefix server run lint`) with zero errors.

## <a name="commit"></a> Commit Message Format

We format our Git commit messages and Pull Request titles using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0). This format leads to an **easier-to-read commit history**.

Each commit message consists of a **header**, an optional **body**, and an optional **footer**:

```text
<type>(<scope>): <short summary>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

#### <a name="commit-header"></a> Commit Message Header

```text
<type>(<scope>): <short summary>
  │       │             │
  │       │             └─⫸ Summary in present tense. Not capitalized. No period at the end.
  │       │
  │       └─⫸ Commit Scope: client|server|scanner|results|api|db
  │
  └─⫸ Commit Type: build|chore|ci|docs|feat|fix|perf|refactor|style|test
```

The `<type>` and `<summary>` fields are mandatory; the `(<scope>)` field is optional.

##### Type

Must be one of the following:

- **build**: Changes that affect the build system or external dependencies
- **chore**: Routine maintenance tasks or config updates
- **ci**: Changes to our CI configuration files and scripts
- **docs**: Documentation-only changes
- **feat**: A new feature
- **fix**: A bug fix
- **perf**: A code change that improves performance
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **test**: Adding missing tests or correcting existing tests

##### Scope (Optional)

The scope is optional and specifies the part of the codebase affected when applicable:

- **client**: Frontend React application changes
- **server**: Backend Express server changes
- **scanner**: URL/Manual listing scanner feature
- **results**: Risk score and red-flag report view
- **api**: Backend endpoints and external API integrations
- **db**: Mongoose models and database caching
- **none/omitted**: Useful for repo-wide, CI, or general changes (e.g., `ci: initialize repo scaffold and pipeline`)

##### Summary

The summary contains a succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize the first letter
- no dot (`.`) at the end

#### <a name="commit-footer"></a> Commit Message Footer

The footer can contain information about breaking changes and is also the place to reference Jira tickets or PRs that this commit closes or relates to:

```text
Fixes SCRUM-13
```

### Revert commits

If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit.
