# Engineering Style Guide

This document establishes the official coding standards, architectural invariants, and style conventions for the **Verilet** codebase.

The repository follows the [**Google JavaScript Style Guide**](https://google.github.io/styleguide/jsguide.html) and [**Google TypeScript Style Guide**](https://google.github.io/styleguide/tsguide.html), customized for our stack (React 19 + Vite frontend, Express 5 + Node.js backend).

All contributors and coding assistants must adhere to these standards. Automated formatting and linting are enforced via **Prettier**, **ESLint**, and **Husky** pre-commit hooks.

---

## 1. Google JS/TS Formatting & Core Syntax

### 1.1 Whitespace & Formatting (Prettier-Enforced)

The team's formatting rules are configured in [`.prettierrc`](file:///c:/Users/aubre/repos/Verilet/.prettierrc) and run automatically on staged files:

- **Indentation:** Exactly 2 spaces. Hard tabs are forbidden.
- **Semicolons:** Semicolons are **mandatory** at the end of every statement. Never rely on Automatic Semicolon Insertion (ASI).
- **Quotes:**
  - Use single quotes (`'`) for string literals in TypeScript/JavaScript code.
  - Use backticks (`` ` ``) for template literals containing interpolation or multiline strings.
  - Use double quotes (`"`) only in JSX/HTML attributes and JSON files.
- **Line Length:** Maximum 100 characters (`printWidth: 100`), matching Google's modern TypeScript (`gts`) guidelines.
- **Trailing Commas:** Mandatory for multi-line object literals, array literals, and parameter lists (`trailingComma: "all"`).

### 1.2 Google Syntax Invariants

- **Mandatory Braces for Control Flow:**  
  Every `if`, `else`, `for`, `while`, and `do` block **must** be enclosed in curly braces `{ ... }`, even when the body contains only a single statement.

  ```ts
  // Disallowed by Google Style:
  if (!url) return null;

  // Required by Google Style:
  if (!url) {
    return null;
  }
  ```

- **Variable Declarations:**
  - Always declare variables with `const` by default.
  - Use `let` only if the variable is reassigned later.
  - The `var` keyword is **forbidden**.

- **Equality Checks:**
  - Always use strict equality (`===`) and strict inequality (`!==`).
  - **Exception:** In accordance with Google JavaScript Style Guide §5.1.2, comparing with `== null` and `!= null` is permitted solely to test whether a value is either `null` or `undefined`. Loose equality is forbidden for all other types and values.

- **Control Flow & Early Exits:**  
  Prefer guard clauses and early returns to avoid deep nesting:
  ```ts
  // Preferred:
  function evaluateDeposit(deposit: number, rent: number): EvaluationResult {
    if (deposit <= 0 || rent <= 0) {
      return { success: false, error: 'Financial values must be positive' };
    }
    if (deposit <= rent) {
      return { success: true, status: 'compliant' };
    }
    // ...
  }
  ```

---

## 2. TypeScript Standards & Type Safety

### 2.1 Typing Strictness

TypeScript strict mode is enabled across both packages. Follow these invariants:

1. **No `any`:**  
   The `any` type is forbidden. When handling untyped data, use `unknown` and narrow the type using type guards or **Zod** schema parsing.
2. **Type Assertions (`as Type`):**  
   Minimize type assertions. Do not cast to bypass compiler errors. Angle-bracket assertions (`<Type>value`) are **forbidden** because they are syntactically ambiguous with JSX/TSX syntax.
3. **Non-Null Assertions (`!`):**  
   Avoid the `!` operator. Prefer optional chaining (`?.`) and nullish coalescing (`??`), or throw an explicit descriptive error if a required value is missing.

### 2.2 Interfaces vs. Type Aliases

In accordance with Google TypeScript style:

- Use **`interface`** for structural contracts, component props, and public API payload shapes that represent objects:
  ```ts
  export interface ScrapeResult {
    title: string;
    rent: number | null;
    address: string | null;
    description: string | null;
    photos: string[];
  }
  ```
- Use **`type`** for unions, primitives, tuples, and mapped types:
  ```ts
  export type SpaceType = 'shared_room' | 'single_room' | '1br' | '2br';
  export type ComplianceStatus = 'compliant' | 'warning' | 'violation' | 'skipped';
  ```
- Use **Zod inference** for schemas that validate runtime data:
  ```ts
  export const SecurityDepositInputSchema = z.object({
    rent: z.number().positive().nullable().optional(),
    deposit: z.number().positive().nullable().optional(),
  });
  export type SecurityDepositInput = z.infer<typeof SecurityDepositInputSchema>;
  ```

---

## 3. Naming Conventions

Follow Google identifier casing consistently across all packages:

| Entity Type                           | Convention                    | Example                                             |
| :------------------------------------ | :---------------------------- | :-------------------------------------------------- |
| **Classes, Interfaces, Types, Enums** | `UpperCamelCase` (PascalCase) | `ListingService`, `ScrapeResult`, `SpaceType`       |
| **React Components**                  | `UpperCamelCase` (PascalCase) | `LandingPage`, `HowItWorksRoad`, `App`              |
| **Functions, Methods, Variables**     | `lowerCamelCase` (camelCase)  | `evaluateDeposit`, `scrapeUrl`, `listingCount`      |
| **Parameters & Object Properties**    | `lowerCamelCase` (camelCase)  | `maxFee`, `spaceType`, `postingBody`                |
| **Global / Module-Level Constants**   | `CONSTANT_CASE`               | `DEFAULT_MAX_APPLICATION_FEE`, `REQUEST_TIMEOUT_MS` |
| **Files & Directories**               | Lowercase with dashes/dots    | `scraper.service.ts`, `scrape.routes.ts`, `app.tsx` |

### 3.1 Acronyms in Identifiers

Google Style treats multi-character acronyms as standard words, capitalizing only the initial letter:

- Write `parseJson()`, **not** `parseJSON()`.
- Write `loadXml()`, **not** `loadXML()`.
- Write `mongoUri`, **not** `mongoURI`.
- Write `htmlFixture`, **not** `HTMLFixture`.
- Write `listingUrl`, **not** `listingURL`.

---

## 4. Backend Standards (`server/src/`)

### 4.1 Layered Architecture Boundaries

Code must reside within its designated architectural layer:

- **`routes/`**: Express route definitions only. Routers must be mounted into `routes/index.ts` under `/api`.
- **`controllers/`**: HTTP handlers that parse inputs, coordinate services, and format HTTP responses. Controllers do not execute direct database queries or raw web scraping.
- **`services/`**: Core business logic, statutory evaluation algorithms, and web scrapers. Services must be testable in isolation.
- **`models/`**: Mongoose schemas and ODM models.
- **`config/`**: Database connections and environment loaders.
- **`app.ts`**: Express application configuration and middleware. **Never call `app.listen()` or `connectDatabase()` in `app.ts`**.
- **`index.ts`**: Entry point that connects to MongoDB and binds the HTTP port.

### 4.2 Request Validation

Every `POST` or `PUT` endpoint must parse and validate `req.body` using a Zod schema before executing business logic. Invalid inputs must return HTTP 400 immediately.

### 4.3 Standardized JSON Response Envelopes

All API endpoints must return a predictable JSON envelope:

```ts
// Success Response (HTTP 200 / 201):
{
  "success": true,
  "data": { ... }
}

// Error Response (HTTP 400 / 404 / 500):
{
  "success": false,
  "error": "Descriptive human-readable error summary",
  "details": [ ... ] // Optional validation or field error array
}
```

### 4.4 External Integration Resilience

When interacting with external listing domains (Craigslist, Zillow, etc.):

- Outgoing client requests must set an explicit timeout (default: 5000ms).
- Unhandled HTTP status codes (403, 404, 500) and timeouts must be caught and return a graceful failure payload rather than throwing unhandled promise rejections or terminating the Node process.

---

## 5. Frontend & UI Standards (`client/src/`)

### 5.1 Component Standards

- Use **React 19 functional components** with TypeScript. Class components are disallowed.
- Use standard React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`). Custom hooks must be prefixed with `use`.
- Keep components focused and modular. Complex UI workflows should separate layout, presentation, and data-fetching.

### 5.2 Accessibility & Mobile Invariants

- **Responsive Design:** Interfaces must render cleanly down to **390px viewport width** without unintended horizontal scrolling.
- **Semantic HTML:** Use proper HTML elements (`<h1>`-`<h6>`, `<main>`, `<section>`, `<nav>`, `<button>`, `<a>`). Do not use `<div>` or `<span>` for clickable navigation elements.
- **Color Contrast:** All text must meet WCAG 2.1 AA contrast requirements (minimum 4.5:1 for normal text, 3:1 for large headings).
- **Decorative Media:** Decorative SVGs, icons, and illustrations must include `aria-hidden="true"`.
- **Motion Accessibility:** Any UI animation or transition must respect user preferences via the `prefers-reduced-motion` media query. When active, animations must snap immediately to their final state.

---

## 6. Git & Commit Style Conventions

Two commit formats are supported in the repository:

### 6.1 Team Infrastructure & Features (Conventional Commits)

Format: `<type>(<scope>): <summary>`

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`.
- **Allowed Scopes:** `client`, `server`, `scanner`, `api`, `db`, `deps`.
- **Example:** `feat(client): add url scanner input form`

### 6.2 CSE 115A Sprint Tasks

Format: `<task-id>: <summary>`

- **Format:** `US-#-T-#: <summary>` or `SCRUM-#-T-#: <summary>`.
- **Example:** `SCRUM-3-T-1: implement scrape endpoint with JSON-LD and OpenGraph fallback`

---

## 7. Automated Enforcement

The style guide is automatically enforced via:

1. **Pre-commit Hooks:** Husky runs `lint-staged` on every commit, executing `prettier --write` and `eslint --fix`.
2. **Cloud CI:** GitHub Actions runs `npx prettier --check` and `npm run lint` across client and server on all pull requests. PRs with linting or formatting violations will be blocked from merging.
