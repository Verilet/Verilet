# Scans API

Saves each listing a signed-in student checks, scores it on the server, and lets them see their past checks. Mounted at `/api/scans`.

## Authentication

- Every request needs a Clerk session token: `Authorization: Bearer <token>`, from `getToken()` in the client.
- The server checks it with `@clerk/express` (`clerkMiddleware` + `getAuth`) and uses the Clerk user ID as the owner of each scan.
- A student only ever sees, opens, or deletes their own scans. Someone else's scan ID answers `404`, the same as one that doesn't exist.
- Server settings: `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `server/.env`. If either is missing, every request answers `503`.

## Responses

All responses use the standard envelopes:

- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": "Message", "details"?: ... }`

| Status | When                                                                     |
| ------ | ------------------------------------------------------------------------ |
| `400`  | The body fails validation. `details` holds Zod's flattened field errors. |
| `401`  | No valid Clerk session.                                                  |
| `429`  | Too many guest checks from one address.                                  |
| `404`  | The scan doesn't exist or belongs to someone else.                       |
| `500`  | The database or scoring failed.                                          |
| `503`  | Sign-in isn't configured on the server.                                  |

## Scan

```ts
{
  id: string; // MongoDB ObjectId as a string
  createdAt: string; // ISO timestamp
  listingUrl: string; // http(s) URL
  rent: number; // monthly, > 0
  bedrooms: 'room' | 'studio' | '1' | '2' | '3' | '4+';
  location: string;
  landlord: string; // '' when not given
  payment: 'bank-transfer' |
    'check' |
    'rental-platform' |
    'zelle-venmo' |
    'cash' |
    'wire' |
    'gift-card' |
    'crypto' |
    'other';
  securityDeposit: number | null;
  applicationFee: number | null;
  contactPhone: string; // '' when not given
  description: string; // '' when not given, at most 5,000 characters
  photoCount: number; // 0 to 10; photo files are not uploaded yet
  score: number; // 0 (low risk) to 100 (high risk)
  checks: {
    id: string;
    title: string;
    detail: string;
    status: 'FLAG' | 'UNKNOWN' | 'OK';
  }
  [];
}
```

The owner's user ID is stored but never returned.

## Endpoints

### `POST /api/scans`

Body: every listing field above except `id`, `createdAt`, `score` and `checks`. Unknown fields are rejected. The server scores the listing, saves it, and answers `201` with the saved scan.

### `GET /api/scans`

The signed-in student's scans, newest first, at most 100. Answers `200` with an array.

### `GET /api/scans/:id`

One of the signed-in student's scans. Answers `200` with the scan, or `404`.

### `DELETE /api/scans/:id`

Deletes one of the signed-in student's scans. Answers `200` with `{ "id": "..." }`, or `404`.

## Guest check

### `POST /api/check`

Scores a listing for anyone, without an account, and saves nothing. Same body and validation as `POST /api/scans`. Answers `200` with `{ score, checks }`, `400` for invalid input, or `429` after 30 checks in an hour from one address. Render's proxy is trusted (`trust proxy` 1) so each visitor's own address is counted.

The client shows a guest the rating, the advice and every `FLAG` check. Signing in shows every check in full, and the guest's last check (kept in that browser tab) is saved to the new account with `POST /api/scans`.

## Scoring

`services/scoring.service.ts` scores a listing on the server, so saved scores can't be changed in the browser. The base score is 5 and the total is capped at 100. Checks appear in this order:

- **Rent vs. area price** (placeholder): compares rent with a rough minimum for the listing type. Below 60% is `FLAG` (+40), below 85% is `UNKNOWN` (+15), otherwise `OK`.
- **Payment method** (placeholder): gift card, wire, or crypto is `FLAG` (+35). Peer-to-peer apps, cash, or "something else" is `UNKNOWN` (+10). Anything else is `OK`.
- **Security deposit**, only when a deposit is given: uses `evaluateSecurityDeposit` (Cal. Civ. Code § 1950.5). Up to one month's rent is `OK`; more than one and up to two months is `UNKNOWN` (+10), since only some small landlords may charge it; more than two months is `FLAG` (+30).
- **Application fee**, only when a fee is given: uses `evaluateApplicationFee` (Cal. Civ. Code § 1950.6). Up to $65 is `OK`; more is `FLAG` (+20).
- **Landlord check** (placeholder): always `UNKNOWN` (+10) until a records lookup exists.
- **Listing details:** `OK` when there is a description or photos, otherwise `UNKNOWN`.

Each deposit and fee detail line ends with the law it is based on. The placeholder rules will be replaced by area rent data (SCRUM-19) and a landlord records lookup.

## Data

MongoDB collection `scans` (Mongoose model `Scan`), indexed on `{ userId: 1, createdAt: -1 }`. The connection string is `MONGO_URI` in `server/.env`.
