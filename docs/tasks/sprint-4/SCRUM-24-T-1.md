---
id: SCRUM-24-T-1
story: SCRUM-24
sprint: 4
assignee: Devarsh Krishnan Jayakrishnan
estimate_hours: 4
---

# Open a shared scan result from a link

## Description

Serves SCRUM-24 (As a student, I want to share the result of my scan with others). Today sharing copies one line of text, so the people a student rents with see the score but not why. This task adds a share link that opens a read-only copy of a result for anyone, with no account and no server: the result is packed into the link itself. Jira: SCRUM-76.

Out of scope: the Share buttons that hand out the link (SCRUM-24-T-2).

## Specs

- `client/src/lib/shareLink.ts`:
  - `sharedScanSchema` (Zod, strict): the shareable part of a scan. `listingUrl` (http or https link), `rent` (positive number), `bedrooms`, `location`, `payment` (the form's values), `securityDeposit` and `applicationFee` (number of 0 or more, or `null`), `score` (whole number 0 to 100), `checks` (1 to 20 of `{ id, title, detail, status }`, where `status` is `FLAG`, `UNKNOWN` or `OK`) and `createdAt` (ISO timestamp). `SharedScan` is its `z.infer` type.
  - `sharePathFor(scan)` takes a `ScanResult` and returns `/shared/<data>`. `<data>` is the shareable fields as JSON, UTF-8 encoded, in URL-safe base64 (`-` and `_`, no `=` padding).
  - The link never contains `contactPhone`, `landlord`, `description`, `photos` or the scan's `id`.
  - `readSharedScan(data)` returns the `SharedScan`, or `null` when `data` isn't URL-safe base64, isn't JSON, or doesn't match `sharedScanSchema`. It never throws.
- Route `/shared/:data` in `client/src/App.tsx` renders `client/src/views/SharedResultView.tsx` for everyone, signed in or not:
  - The listing summary (for example "2 bed · $1,200 / month · Santa Cruz, CA"), the rating chip, the rating's headline and advice, the risk score out of 100 with its meter, and a "What we checked" list with every check's title, detail and status.
  - A note: "Someone shared this result with you. Check a listing yourself before sending money."
  - A "Check your own listing" link to `/check`.
  - No Share button, no "More details" toggle (the details are always shown) and no link to My scans.
  - When `readSharedScan` returns `null`, the page shows the heading "This share link doesn't work", the text "It may have been cut off when it was copied. Ask for the link again.", and a "Check a listing" link to `/check`, and no result.

## Requirements

- Client only: no server changes and no new dependencies.
- The decoded link is checked with Zod before anything is shown. No `any`; JSDoc with `@param` and `@returns` on every function, per `docs/style-guide.md`.
- The shared page reuses the results page's styles and keeps the 390px mobile layout.
- Existing client tests keep passing, including SCRUM-48-T-7 and SCRUM-48-T-8.
- Tests live in `client/tests/SCRUM-24-T-1_shareLink.test.tsx` and run offline.

## Acceptance criteria

1. `sharePathFor(scan)` returns a path that starts with `/shared/` and uses only URL-safe characters, and `readSharedScan` on its data gives back the shareable fields with the same values.
2. The data in the link never contains the scan's contact phone, landlord name, description, photos or ID.
3. Opening `/shared/<data>` while signed out shows the listing summary, the rating chip and headline, the score out of 100, and every check's title, detail and status, with a "Check your own listing" link to `/check`.
4. The shared page shows the "Someone shared this result" note, has no Share button and no link to My scans, and shows the same result when signed in.
5. A link whose data isn't URL-safe base64, isn't JSON, or doesn't match the schema (for example a score of 150 or a `javascript:` listing link) shows "This share link doesn't work" and no result, without crashing.

## Tests

File: `client/tests/SCRUM-24-T-1_shareLink.test.tsx`
Setup for all: a sample `ScanResult` with a contact phone, landlord name, description, a photo and three checks. Pages are rendered with `<App />` in a `MemoryRouter`. Test names start with the task ID and the criterion, grouped under `describe('SCRUM-24-T-1: shared result links', ...)`.

| Test name                                                                        | Setup                                                                                                                         | Asserts                                                                                                                                                   | Criterion |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `SCRUM-24-T-1 [Criterion 1] round-trips a scan through its share link`           | `sharePathFor(scan)`, then `readSharedScan` on the part after `/shared/`                                                      | the path matches `^/shared/[A-Za-z0-9_-]+$`; the result equals the scan's shareable fields; a location with `é` and `·` survives                          | 1         |
| `SCRUM-24-T-1 [Criterion 2] leaves personal details out of the link`             | decode the link's data as JSON                                                                                                | no `contactPhone`, `landlord`, `description`, `photos` or `id` keys, and the phone number, landlord name and description text don't appear anywhere in it | 2         |
| `SCRUM-24-T-1 [Criterion 3] shows a shared result to a signed-out visitor`       | render `/shared/<data>` signed out                                                                                            | the summary line, the rating chip and headline, "82" with "/ 100", each check's title, detail and status, and a "Check your own listing" link to `/check` | 3         |
| `SCRUM-24-T-1 [Criterion 4] shows the shared result read-only, signed in or not` | render `/shared/<data>` signed out, then with the Preview bar's `loggedIn` on                                                 | the note is shown; no Share button and no My scans link in the page; the same heading and score both times                                                | 4         |
| `SCRUM-24-T-1 [Criterion 5] rejects a broken link: <case>`                       | `readSharedScan` and `/shared/<data>` with `not base64!`, base64 of `{oops`, a score of 150, and a `javascript:` listing link | `readSharedScan` returns `null`; the page shows "This share link doesn't work" and no score                                                               | 5         |
