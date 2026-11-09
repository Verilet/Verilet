---
id: SCRUM-48-T-8
story: SCRUM-48
sprint: 2
assignee: Devarsh Jayakrishnan
estimate_hours: 5
---

# Build the "How it works" page as a road with a car and six houses

## Description

Serves SCRUM-48 (a short explanation of how Verilet works). This task builds the `/how-it-works` page: a road runs down the page, scrolling sends a car from house to house, and each of six houses explains one step. The design is Figma frames "8 · How it works page (road + houses)" and "8m · How it works page (phone)". The wording comes from `client/src/content/guide.ts`, created in SCRUM-48-T-7.

Out of scope: the landing page (SCRUM-48-T-7) and the explanation panel on the Check page.

## Specs

- `/how-it-works` renders for logged-out and logged-in users. The header item "How it works" links to it (logged-out header) and is marked `aria-current="page"` on this page.
- The page has an `<h1>` "Follow the road to your risk rating" and an ordered list of six stops, in this order: Paste the link, Rent vs. area price, Payment method, Landlord check, Listing details, Your risk rating (the finish).
- Each stop is a list item with a stop label ("Stop 1" ... "Stop 5", "Finish"), a title as an `<h2>`, a "what we do" sentence, and a "Why it matters" note. The house drawing is decorative (`aria-hidden`).
- Desktop (width 720px and up): the road is centered; stops alternate left and right of it.
- Phone (under 720px): the road runs down the left edge and every stop stacks to its right, the house above its card.
- Motion: a car drawing sits on the road. When a stop's numbered marker scrolls past 60% of the screen height (or the page reaches the bottom), the car plays a fixed 800ms drive from its current stop to that stop. The scroll only triggers the drive: scrolling further during a drive does not change it, and the car does not move while no stop is crossed. If several stops are crossed at once, the car plays one continuous drive to the furthest one (800ms plus 150ms per extra stop, up to 1400ms), lighting up each stop as it reaches it. If the destination changes during a drive, the car heads to the new stop without stopping first. Scrolling back past a stop by more than 40px drives it back. The stop the car is parked at is highlighted (`data-active="true"`: house lifts and card gets an accent outline) and announced to nobody (no live region). Stops behind the car are `data-passed="true"` and their marker turns green.
- Status bar: a sticky bar above the road shows the current stop's label, a short `status` sentence from `GUIDE.stops` saying what is happening there, and a six-segment progress bar. It is `aria-hidden` because the stops already carry the same information.
- Reduced motion: when `prefers-reduced-motion: reduce` is on, the car stays at the top, no stop is highlighted or passed, the status bar is not shown, and no transitions run.
- The closing "Check a listing" link goes to `/check`.
- Car transition: a plain click on that link fades the page away around the car over 180ms. `/check` then opens with the car's wheels and windows fading while its body reshapes into the "Listing link" box over 620ms, the page fading in around it and the cursor in the box. It plays once and does not replay on refresh. With reduced motion on, on a modified click (for example opening a new tab), or if the browser has no Web Animations support, the link behaves normally with no transition.

## Requirements

- Wording is imported from `client/src/content/guide.ts`; no copied strings in the view.
- Scroll handling uses a passive scroll listener cleaned up on unmount, `requestAnimationFrame` throttling, and refs (no `document.querySelector`). Road positions are measured on load and when the page size changes, not on every frame.
- The page is fully understandable with animation off: all six stops are in the DOM and readable in order.
- Houses and car are inline SVG components; no image files and no new runtime dependencies.
- Colour contrast of text at least 4.5:1; layout has no horizontal scroll at 390px.

## Acceptance criteria

1. `/how-it-works` shows the `<h1>` and an ordered list with exactly six stops in the specified order.
2. Each stop has a label, an `<h2>` title, a "what we do" sentence, and a "Why it matters" note taken from `GUIDE`.
3. The logged-out header "How it works" is a link to `/how-it-works` and is `aria-current="page"` on that page.
4. The car is present, and scrolling moves it and changes which stop has `data-active="true"`.
5. With reduced motion on, no stop has `data-active="true"` after scrolling and the car does not move.
6. The house and car graphics are `aria-hidden`.
7. The closing link has `href="/check"`.
8. Removing the scroll listener on unmount leaves no listener behind.
9. Crossing a stop plays a drive over several frames that ends exactly on that stop and then stops requesting frames.
10. The drive takes the same number of frames however far past the stop the page was scrolled, and scrolling during a drive does not change the car's path.
11. The car does not move when no stop is crossed, including a small scroll back.
12. A stop becomes `data-active="true"` only when the car reaches it; after a long scroll the car makes one continuous drive past each stop in order, and a new destination mid-drive changes course without a jump; scrolling up drives it back.
13. The status bar shows the label and status of the active stop, and stops behind the car are `data-passed="true"`.
14. With reduced motion on, the status bar is not shown and no stop is `data-passed="true"`.
15. Unmounting during the car's animation cancels the pending frame.
16. A plain click on the closing link fades the page and stays on it until the fade ends; `/check` then opens with the car overlay, the "Listing link" box focused, and the car's body animating to that box's position and size; the overlay is removed when the morph ends.
17. With reduced motion on, or on a modified click, the transition does not play.

## Tests

File: `client/tests/SCRUM-48-T-8_how-it-works.test.tsx`
Setup for all: render `App` in `MemoryRouter initialEntries={['/how-it-works']}`; stub `window.matchMedia`, `requestAnimationFrame`, and element geometry (`getBoundingClientRect`) in `jsdom`.

- Criterion 1: `SCRUM-48-T-8 shows six stops in order` — asserts the heading and the six `<h2>` texts in order.
- Criterion 2: `SCRUM-48-T-8 each stop has its explanation` — compares text with `GUIDE.stops`.
- Criterion 3: `SCRUM-48-T-8 header link is current on this page` — asserts `href` and `aria-current`.
- Criterion 4: `SCRUM-48-T-8 car follows the scroll and highlights a stop` — fires a scroll event with stubbed geometry and asserts the car's `style.transform` changed and one stop has `data-active="true"`.
- Criterion 5: `SCRUM-48-T-8 reduced motion turns animation off` — `matchMedia` returns `matches: true`, scrolls, asserts no active stop and an unchanged car position.
- Criterion 6: `SCRUM-48-T-8 graphics are decorative` — asserts the SVGs have `aria-hidden="true"`.
- Criterion 7: `SCRUM-48-T-8 closing link goes to the check page` — asserts `href`.
- Criterion 8: `SCRUM-48-T-8 cleans up the scroll listener` — spies on `removeEventListener`, unmounts, asserts it was called with `scroll`.
- Criterion 9: `SCRUM-48-T-8 car plays over several frames and parks exactly on the stop` — steps frames by hand, asserts partial progress, the final position, and no pending frame.
- Criterion 10: `SCRUM-48-T-8 drive takes the same time however far past the stop you scroll` and `SCRUM-48-T-8 scrolling during a drive does not steer the car` — compare frame counts and per-frame positions.
- Criterion 11: `SCRUM-48-T-8 car does not move when no stop is crossed` — asserts an unchanged transform.
- Criterion 12: `SCRUM-48-T-8 a long scroll is one continuous drive`, `SCRUM-48-T-8 a new destination mid-drive changes course without a jump`, `SCRUM-48-T-8 stop lights up only when the car arrives`, `SCRUM-48-T-8 car visits every stop in order after a long scroll`, and `SCRUM-48-T-8 car drives back when scrolling up` — assert `data-active` across frames.
- Criterion 13: `SCRUM-48-T-8 status bar says what happens at the current stop` and `SCRUM-48-T-8 stops behind the car are marked as passed` — compare with `GUIDE.stops` and assert `data-passed`.
- Criterion 14: `SCRUM-48-T-8 reduced motion hides the status bar` — asserts no status bar and no passed stop.
- Criterion 15: `SCRUM-48-T-8 cancels a running animation on unmount` — asserts no pending frame after unmount.
- Criterion 16: `SCRUM-48-T-8 check link morphs the car into the listing link` — stubs `animate`, finishes the animations by hand, and asserts the route, focus, final morph geometry, and overlay.
- Criterion 17: `SCRUM-48-T-8 reduced motion skips the car flight` and `SCRUM-48-T-8 modified click skips the car flight` — assert no flight element.
