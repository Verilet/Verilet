# Saved Scans API

Stores the listings a signed-in student has checked, so they can see them again later on any device. Mounted at `/api/scans`. Task: SCRUM-69-T-1.

The API stores a scan as it was evaluated: the listing, its score and its checks. It doesn't score listings itself; that is the evaluation API's job (SCRUM-70).

## Authentication

- Every request needs a Clerk session token: `Authorization: Bearer <token>`, from `getToken()` on the client.
- The server checks it with `@clerk/express` (`clerkMiddleware` and `getAuth`) and uses the Clerk user ID as the owner of each scan.
- A student only ever sees, opens or deletes their own scans. Another student's scan ID answers `404`, the same as one that doesn't exist.
- Server settings: `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, in `server/.env` or `server/.env.local` (loaded first by `server/src/config/loadEnv.ts`). If either is missing, blank or not a Clerk key of the right kind, every request answers `503`.

## Responses

All responses use the standard envelopes:

- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": "Message", "details"?: ... }`

| Status | When                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------- |
| `400`  | The body fails validation: `"Validation failed"`, with Zod's formatted field errors in `details`. |
| `401`  | No signed-in Clerk user.                                                                          |
| `404`  | The scan doesn't exist, the ID is malformed, or it belongs to someone else.                       |
| `500`  | The database failed.                                                                              |
| `503`  | Sign-in isn't configured on the server.                                                           |

## Saved scan

```ts
{
  id: string; // MongoDB ObjectId as a string
  createdAt: string; // ISO timestamp, set by the server
  listingUrl: string; // http(s) link, at most 2,048 characters
  rent: number; // monthly, > 0
  bedrooms: 'room' | 'studio' | '1' | '2' | '3' | '4+';
  location: string; // 2 to 200 characters
  landlord: string; // '' when not given
  payment:
    | 'bank-transfer'
    | 'check'
    | 'rental-platform'
    | 'zelle-venmo'
    | 'cash'
    | 'wire'
    | 'gift-card'
    | 'crypto'
    | 'other';
  securityDeposit: number | null;
  applicationFee: number | null;
  contactPhone: string; // '' when not given
  description: string; // '' when not given, at most 5,000 characters
  photoCount: number; // 0 to 10; photo files are not uploaded
  score: number; // whole number, 0 (low risk) to 100 (high risk)
  checks: {
    id: string;
    title: string;
    detail: string;
    status: 'FLAG' | 'UNKNOWN' | 'OK';
  }[]; // at most 20
}
```

The owner's user ID is stored but never returned.

## Endpoints

### `POST /api/scans`

Body: every field above except `id` and `createdAt`. Unknown fields, including `userId`, are rejected. Saves the scan for the signed-in student and answers `201` with the saved scan.

### `GET /api/scans`

The signed-in student's scans, newest first, at most 100. Answers `200` with an array.

### `GET /api/scans/:id`

One of the signed-in student's scans. Answers `200` with the scan, or `404`.

### `DELETE /api/scans/:id`

Deletes one of the signed-in student's scans. Answers `200` with `{ "id": "..." }`, or `404`.

## Data

MongoDB collection `savedscans` (Mongoose model `SavedScan` in `server/src/models/savedScan.model.ts`), indexed on `{ userId: 1, createdAt: -1 }` so a student's newest scans load quickly. The connection string is `MONGO_URI` in `server/.env`.

## Code

| Layer      | File                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| Routes     | `server/src/routes/scans.routes.ts`                                                          |
| Controller | `server/src/controllers/scans.controller.ts`                                                 |
| Service    | `server/src/services/scanPersistence.service.ts`                                             |
| Model      | `server/src/models/savedScan.model.ts`                                                       |
| Schema     | `server/src/schemas/savedScan.schema.ts`                                                     |
| Middleware | `server/src/middleware/auth.middleware.ts`, `validate.middleware.ts` (shared `validateBody`) |
