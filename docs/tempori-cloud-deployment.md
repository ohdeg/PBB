# Tempori account library and page mode deployment

Apply `infra/mysql/migrations/20261101_tempori_cloud_library.sql` before deploying the backend. It creates durable score/reservation/idempotency/cleanup records; there is deliberately no cascading user foreign key, because account deletion must leave cleanup jobs alive until private objects are removed. Existing databases require this manual migration; deployment was not performed by this change.

Configure the backend manually with these optional variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TEMPORI_R2_BUCKET` | empty (cloud disabled) | Dedicated **private** score bucket; must differ from public image bucket |
| `TEMPORI_MAX_FILE_BYTES` | `26214400` |25MiB per original |
| `TEMPORI_MAX_USER_BYTES` | `524288000` |500MiB reserved and retained per account |
| `TEMPORI_MAX_USER_FILES` | `200` | Includes active reservations and pending cleanup |

The private adapter uses existing configured R2 endpoint, region and credentials, independently of the public image enabled flag. Give the token only required bucket/object permissions; never put it in the frontend. Keep the score bucket's public domains and r2.dev access disabled. The code refuses an empty private bucket or the configured public-image bucket; it cannot detect a bucket made public outside the app.

R2 CORS must allow the actual app origin, GET and HEAD. Signed GET links expire after five minutes, are never persisted by the app, and are bearer links until expiry/object deletion. Account metadata responses use `private, no-store`. Deletion returns202 after the durable deletion state commits; a scheduler removes objects, retries failures after five minutes and cleans abandoned uploads older than24h. Upload leases last10min; R2 requests have2min total timeout. An interrupted upload can therefore require waiting for its lease before retrying the same key.

Spring multipart limits are25MiB/file and27MiB/request. Configure the reverse proxy/platform request body ceiling to at least27MiB and suitable upload timeouts. Raising application environment limits alone does not raise these transport ceilings.

New originals for authenticated users are first retained as account-scoped local drafts, then uploaded. Local-to-account migration is explicitly selected and keeps original bytes and local annotation identity. Logout/account switches abort requests and invalidate late results. Successful account refresh removes caches for confirmed deleted server records without deleting local originals or annotations. Offline access is limited to previously cached originals; it cannot guarantee the latest remote deletion state.

PDF.js6.4.299 worker is bundled by Vite. Its versioned CMaps/fonts/WASM, MediaPipe1.2.0 module WASM and pinned float16 FaceLandmarker model are self-hosted under `frontend/public/tempori/`. Model provenance/hash is in `vision/manifest.json`. No camera frames or facial data are stored or uploaded. The camera starts only from its explicit button, requests video only, uses a Worker with no main-thread inference fallback, and stops on hidden tab/unmount. Device support and gesture accuracy remain experimental until native testing.

Managed access denied both safe-template access attempts in this session, despite listed exceptions. No actual `.env` was read or changed. Manually add the four variable names above to your own `.env` or deployment configuration. Existing `.env.example` content was not accessed or overwritten.

Required live acceptance after configuration: two independent sessions with the same account upload/list/open and compare original SHA256; foreign account/stale token404/401; concurrent quota and deletion interleavings on MySQL; kill/retry around R2/DB writes; private bucket/CORS check; real iPhone/iPad Safari, Android Chrome and desktop camera permission/rotation/accuracy/ten-minute false-positive tests. Unit mocks and synthetic browser results do not establish these outcomes.
