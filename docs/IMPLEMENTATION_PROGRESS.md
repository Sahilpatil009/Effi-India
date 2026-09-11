# Web MVP implementation progress

Reviewed 12 September 2026. Local builds/tests pass; live integration blocked by Supabase DNS (see below). Do not claim live verification before the gates pass.

## Milestone 1: local backend foundation — done (local only)

- Server-generated unique voice rooms and participant identities; client-supplied room names rejected (`token-server/api/token.ts:18`, `agent/src/supabase.ts:38`).
- Validated language/name input, bounded auth verification (10s timeout), controlled 503 on auth outage, and `Cache-Control: no-store`.
- Stable per-user/per-call ticket numbers with recovery after concurrent inserts or a lost RPC response, using the existing `ticket_number` unique constraint (`agent/src/supabase.ts:70`).
- Coordinate bounds, photo-after-location enforcement, and clearing stale location/photo state when recollecting evidence (`agent/src/tools.ts:72`).
- Node regression tests for token isolation, authorization failures, registration retries and category/evidence guards (`agent/tests/*.test.ts`, `token-server/tests/token.test.cjs:1`). 12 agent + 4 token tests pass via `Set-Location agent; node --import tsx/esm --test tests/*.test.ts` and `Set-Location token-server; node --test tests/*.test.cjs`.
- Fixed token-server build approval and added `typecheck`/`test` commands; `dashboard: npx tsc --noEmit + eslint` and `agent/token-server: npx tsc --noEmit` pass.
- Added the mobile `development` EAS profile (`mobile/eas.json:1`).
- Restored `PROJECT.md:6` and corrected `README.md:15` model description.

## Milestones 2–4: citizen web — code done, live verification pending

Implemented in `dashboard/` (unverified against live Supabase/LiveKit):

- Citizen home at `/` with three category cards (`dashboard/src/app/page.tsx:5`); admin moved to `/admin` (`dashboard/src/app/admin/page.tsx:1`) with `requireAdmin` guard.
- Shared auth: `dashboard/src/lib/supabase/proxy.ts:32` redirects unauthenticated `/report`/`/requests`/`/api` to `/login`; `dashboard/src/app/auth/callback/route.ts` + `login/actions.ts` handle magic-link.
- Browser voice slice at `/report` (`dashboard/src/components/citizen/voice-report.tsx:48`): pre-flight `getUserMedia`, `livekit-client` Room, RPC handlers `effi.provide_location`/`effi.provide_photo` registered before agent requests, 20s token fetch timeout, location (12s `enableHighAccuracy`) + photo upload to `complaint-evidence` (`<category>/<room>/<uuid>.jpg`) with preview, transcript auto-scroll, `DataReceived` `effi.complaint` receipt, mute/enable-sound, generation-scoped RPC expiry, Reconnecting/Connected states, and cleanup on `end`/unmount.
- Token proxy `dashboard/src/app/api/voice/token/route.ts:3` validates `category`+`language=en|hi`, verifies `supabase.auth.getUser()` + `getSession()`, forwards to `TOKEN_SERVER_URL` with 15s timeout and `no-store`.
- My Requests `dashboard/src/app/requests/page.tsx:7` + detail `dashboard/src/app/requests/[id]/page.tsx:8` scoped by `user_id`, `LiveRequests` Realtime channel `citizen-requests-${userId}` plus `visibilitychange`/`focus` refresh (`dashboard/src/components/citizen/live-requests.tsx:9`).
- Polish 2026-09-12: transcript scroll, photo preview with `URL.createObjectURL`, explicit mute toggle, location/photo error recovery, receipt persists via DB (`/requests/[id]`) not just spoken ticket, responsive Tailwind layout, `error.tsx` boundary.

## Blocked — live integration gate (not passed)

- `NEXT_PUBLIC_SUPABASE_URL=https://lmtgimyklueosoywasyr.supabase.co` and `SUPABASE_URL` in `agent/.env.local` / `token-server/.env.local` fail DNS `ENOTFOUND` (`nslookup`/`curl` of that host fail; `dashboard` and `agent` hosts match but are unresolvable). Local `pnpm`/`npm` builds pass, but any authenticated flow, `fetch /auth/v1/user`, or `create_complaint_ticket` RPC will fail until the host is restored. This was last verified 2026-09-12 via `node -e fetch('https://lmtgimyklueosoywasyr.supabase.co/auth/v1/health')` → `fetch failed`.
- Required before claiming demo-ready: (1) confirm Supabase project still exists / is not paused at supabase.com dashboard; if replaced, update `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `dashboard/.env.local`, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in `agent/.env.local`, `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` in `token-server/.env.local`, and redeploy token server; (2) inspect deployed migrations (especially `20260522_phase2_*.sql` user ownership + `20260522_phase3_admin_dashboard.sql` RLS/Realtime) — do not blindly replay on prod; (3) verify `complaint-evidence` bucket public read + scoped write, `supabase_realtime` publication for `complaints`/`complaint_evidence`/`complaint_locations`; (4) create dedicated `citizen@test` + `admin@test` (row in `admin_access` with `is_active=true`, lowercased email) and test RLS (citizen A cannot read B; citizen cannot `update status`); (5) run one real `POWER_OUTAGE` call (location only, no photo), one `POTHOLE`/`SANITATION` call (location+photo), one mic-denied + location-denied + photo-cancel flow, and verify exactly one ticket per call, receipt survives refresh, admin feed appears without reload and status update propagates to citizen.

## Next: polish & rehearsal

After the host is restored, run `WEB_MVP_TEST_PLAN.md:81` acceptance matrix and the 4-minute teacher demo (`WEB_MVP_TEST_PLAN.md:105`). Keep a local `TOKEN_SERVER_URL=http://127.0.0.1:3002/token` for dev and a hosted Vercel URL for the hosted demo; use `https`/localhost for geolocation and rehearse permissions on the presentation laptop. Do not add new categories/gamification/analytics until the matrix passes three consecutive runs.
