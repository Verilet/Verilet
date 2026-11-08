---
id: SCRUM-48-T-7
story: SCRUM-48
sprint: 2
assignee: Devarsh Jayakrishnan
estimate_hours: 4
---

# Build the landing page that explains Verilet and starts a check

## Description

Serves SCRUM-48 (a short explanation of how Verilet works). Logged-out visitors currently land straight on the form. This task adds a landing page at `/` that explains what Verilet does and sends them to the form, which moves to `/check`. The design is Figma frame "7c · Landing page (v3 · warm, calmer)". All wording lives in one file, `client/src/content/guide.ts`, so it can be reused by the Results page and the How it works page (SCRUM-48-T-5 and SCRUM-48-T-8).

Out of scope: form fields, link autofill and the other PR #5 review items (separate tasks); the road-style How it works page (SCRUM-48-T-8), the Welcome back screen for logged-in users, and the explanation panel on the Check page.

## Specs

- `/` renders the landing page when logged out. When logged in, `/` still renders the Welcome back / Home page.
- `/check` renders the Check page (the form) for everyone.
- The landing page has four sections, top to bottom:
  1. Hero: `<h1>` "Check a rental listing before you pay", a one-line pitch, a "Check a listing" link, a "See how it works" link, and "No account needed · Takes about a minute", beside an "Example result": a static HIGH RISK 82 / 100 result with three reasons (Rent vs. area price FLAG, Payment method FLAG, Landlord check UNKNOWN).
  2. `<h2>` "What we check, and why": the four checks (Rent vs. area price, Payment method, Landlord check, Listing details) beside an example listing. Choosing a check shows its one-sentence reason and highlights the part of the listing it looks at. The first check starts selected.
  3. `<h2>` "How it works": a road with the three steps (Paste the link, We check for scam signs, Get a risk rating) and a link to `/how-it-works`.
  4. `<h2>` "Quick answers": the note "A score is a rating, not a guarantee. Always visit in person before you pay." and three expandable questions (Do I need an account? / Does a low score mean it is safe? / What if I get a high score?), then a closing block with a "Check a listing" link, and the footnote "Verilet gives a risk rating, not a guarantee."
- Following a link to another page starts that page at the top. Back and forward keep the saved scroll position.
- The "How to read your result" legend (HIGH RISK, FLAG, UNKNOWN, OK, each with a one-line meaning) is on the results page, in the details panel.
- "Check a listing" links go to `/check`. "See how it works" goes to `/how-it-works`.
- The page uses the warm palette (cream background, one terracotta accent) through CSS variables in a `theme-warm` wrapper; the rest of the app keeps the current palette.
- The words "safe" and "guarantee" are never used to promise safety: the only uses are the question "Does a low score mean it is safe?" with the answer "No", and the "not a guarantee" notes.
- The example result is marked as an example and is not stored as a scan.
- Layout works at 390px wide: sections stack in one column with no horizontal scroll.
- Motion: the example score counts up to 82 when it first appears. The hero is visible immediately. Each section below it fades up the first time it scrolls into view (`.reveal[data-shown]`), and the example score bar fills as it appears.
- Steps road: a decorative road sits above the three steps. When the steps scroll into view, a car drives past steps 1, 2 and 3 once with a fixed animation, and the step it has reached has `data-active="true"`.
- Car drive-through: a plain click on either "Check a listing" link lays a road across the screen under that link's section, and a car drives across it while the page fades (880ms). `/check` then fades in over 300ms with the cursor in the "Listing link" box.
- Reduced motion, or no `IntersectionObserver`: every section is shown from the start, the car stays at the start of the road, and no step is highlighted. Reduced motion also skips the car flight.

## Requirements

- Wording is imported from `client/src/content/guide.ts`; views contain no copied strings for the steps, checks, legend or Q&A.
- Semantic HTML: one `<h1>`, headings in order, links for navigation, sufficient colour contrast (text at least 4.5:1).
- Adds `react-router-dom` (client only) and replaces the `useState` view switching in `App.tsx` with routes: `/`, `/check`, `/how-it-works`, `/scans`, `/results/:scanId`, and a "Page not found" screen for any other path. `main.tsx` wraps `App` in `BrowserRouter`; `client/vercel.json` rewrites all paths to `/index.html`.
- Header items are real links; the `?loggedIn=true` preview flag is remembered for the browser tab.
- Existing tests keep passing; those that expect the form at `/` while logged out are updated to use `/check`.

## Acceptance criteria

1. Logged out, `/` shows the landing page with the `<h1>` "Check a rental listing before you pay" and no form.
2. Logged in, `/` still shows the Welcome back page.
3. `/check` shows the form for logged-out users.
4. Both "Check a listing" links on the landing page have `href="/check"`.
5. The "See how it works" link has `href="/how-it-works"`.
6. The page contains the four `<h2>` sections listed in Specs, and the four checks.
7. The example result shows HIGH RISK, 82, and the three reasons, and is labelled as an example.
8. The page never states that a listing is "safe" and always includes the "not a guarantee" note.
9. Wording for steps, checks, legend and Q&A is exported from `client/src/content/guide.ts`.
10. An unknown path shows "Page not found" with a link home, an unknown scan id shows "We couldn't find that scan", and `/scans` redirects to `/` when logged out.
11. Sections start hidden with `data-shown="false"` and become `data-shown="true"` when they scroll into view.
12. When the steps scroll into view, each step becomes `data-active="true"` in order, on a set schedule.
13. Without `IntersectionObserver`, or with reduced motion, every section has `data-shown="true"` and no step is active.
14. A plain click on a landing "Check a listing" link plays the car drive-through, stays on the page until it ends, and then opens `/check` with the "Listing link" box focused and the fade overlay removed when it ends.
15. Choosing a check shows its reason, hides the other reasons, and highlights only the matching part of the example listing.
16. The results page details panel shows the four legend labels with their meanings, and the landing page does not.
17. With scroll animation the example score starts at 0 and counts up when it comes into view; without it the score shows 82.
18. Following a link to another page scrolls to the top, and the initial page load does not.

## Tests

File: `client/tests/SCRUM-48-T-7_landing.test.tsx`
Setup for all: render `App` in `MemoryRouter` (default logged out).

- Criterion 1: `SCRUM-48-T-7 logged out root is the landing page` — asserts the `<h1>` and that no "Listing link" or "Street address" field exists.
- Criterion 2: `SCRUM-48-T-7 logged in root is still the welcome page` — renders with `loggedIn`.
- Criterion 3: `SCRUM-48-T-7 check route shows the form` — renders `/check`.
- Criterion 4: `SCRUM-48-T-7 check links go to the form` — asserts every "Check a listing" link in the page body has `href="/check"`.
- Criterion 5: `SCRUM-48-T-7 how it works link` — asserts the `href`.
- Criterion 6: `SCRUM-48-T-7 shows all sections` — asserts the headings and four check titles.
- Criterion 7: `SCRUM-48-T-7 example result` — asserts "EXAMPLE RESULT", "HIGH RISK", "82", and the three reasons.
- Criterion 8: `SCRUM-48-T-7 never promises safety` — asserts the not-a-guarantee text and that no text matches `/\blisting is safe\b/i`.
- Criterion 9: `SCRUM-48-T-7 wording comes from the content file` — imports `GUIDE` and asserts each step and FAQ answer is rendered.
- Criterion 10: `SCRUM-48-T-7 page routes` — three tests: unknown path, unknown scan id, and `/scans` while logged out.
- Criterion 11: `SCRUM-48-T-7 sections reveal when scrolled into view` — stubs `IntersectionObserver` and asserts `data-shown`.
- Criterion 12: `SCRUM-48-T-7 car drives past each step on a set schedule` — uses fake timers and asserts the active step in order.
- Criterion 13: `SCRUM-48-T-7 everything shows without scroll animation` — checks both no observer and reduced motion.
- Criterion 14: `SCRUM-48-T-7 check link plays the car drive-through` — stubs `animate`, finishes the animations by hand, and asserts the route, focus, and overlay.
- Criterion 15: `SCRUM-48-T-7 choosing a check highlights the listing` — clicks a check and asserts the reason and `data-highlight`.
- Criterion 16: `SCRUM-48-T-7 legend is on the results page` — asserts the labels on a results page and none on the landing page.
- Criterion 17: `SCRUM-48-T-7 example score counts up` — mocks Motion's `animate`; `SCRUM-48-T-7 example result` covers the no-animation case.
- Criterion 18: `SCRUM-48-T-7 opening another page starts at the top` — clicks the road link and asserts `window.scrollTo(0, 0)`.
