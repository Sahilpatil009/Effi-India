# Handoff — Effi India (12 Sep 2026)

## 1. What this is
Multilingual AI-assisted civic complaint system — citizen speaks (voice agent) → shares device location + photo → gets ticket → admin updates status → citizen sees live update. Monorepo: `mobile/` (Expo), `agent/` (LiveKit worker), `dashboard/` (Next.js 16 citizen+admin web), `token-server/` (Vercel LiveKit JWT), `supabase/` (migrations).

## 2. Repo state (branch `main`)
- `babd4f5` polish citizen web + document DNS block (pushed), plus local env fixes not committed (see §4). Working tree now has Supabase `lmtgimyklueosoywasyr.supabase.co` resumed and verified.
- Key commits: `1ca800e` stabilize voice session + add citizen web MVP (server-generated rooms, ticket dedup, `voice-report`/`requests`/`admin` split), `babd4f5` polish.

## 3. Architecture (see `PROJECT.md:6`, `docs/WEB_MVP_TEST_PLAN.md:22`)
- `dashboard/src/app/page.tsx:5` `/` citizen home (3 cards) → `dashboard/src/app/report/page.tsx:1` `/report?category=` voice call → `dashboard/src/app/requests/page.tsx:7` `/requests` + `[id]` → `dashboard/src/app/admin/page.tsx:1` `/admin` (moved from `/`, `requireAdmin` guard). Shared `dashboard/src/lib/supabase/proxy.ts:32`, `dashboard/src/app/api/voice/token/route.ts:3` proxies to `TOKEN_SERVER_URL`.
- `dashboard/src/components/citizen/voice-report.tsx:48` LiveKit `Room`, RPC `effi.provide_location`/`effi.provide_photo` (registered before agent), transcript auto-scroll, photo preview, `DataReceived` `effi.complaint` receipt.
- `token-server/api/token.ts:7` strict `category/language`, rejects `roomName`, `AbortSignal.timeout(10s)`, `503` on auth outage, `Cache-Control: no-store`, UUID `sessionId` per call.
- `agent/src/supabase.ts:38` `generateTicketNumber(userId,room)` + unique `ticket_number` dedup, `parseStoragePath` validates origin/bucket/category/room, `agent/src/tools.ts:72` bounds, photo-after-location, `insertComplaint` + `publishData` receipt.
- `mobile/eas.json:1` `development` profile added for `expo start --dev-client`.

## 4. Environment (local, gitignored)
All three `SUPABASE_URL` must be `https://lmtgimyklueosoywasyr.supabase.co`:
- `dashboard/.env.local`: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_***` (full from Settings → API Keys) + `TOKEN_SERVER_URL=http://127.0.0.1:3002/token` (local) or Vercel `https://.../api/token` for hosted.
- `agent/.env.local`: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY=sb_secret_***` (was `anon` JWT — fixed 2026-09-12), plus `LIVEKIT_URL=wss://effi-india-s02r1o1u.livekit.cloud`, `LIVEKIT_API_KEY`/`SECRET` (from LiveKit Cloud), `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID`.
- `token-server/.env.local`: `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` same as dashboard + `SUPABASE_SERVICE_ROLE_KEY` same secret (was truncated `401` — fixed), plus LiveKit trio.

If hosted, mirror these in Vercel env vars.

## 5. Database (Supabase `lmtgimyklueosoywasyr`)
- Migrations in `supabase/migrations/`: `20260521_phase1_*`, `20260521_phase1_normalize_complaints.sql`, `20260522_phase2_auth_profiles_and_user_owned_complaints.sql` (adds `user_id`, `profiles`, RLS), `20260522_phase3_admin_dashboard.sql` (adds `admin_access`, admin RLS, `supabase_realtime` pubs). Check `storage.buckets` `complaint-evidence` `public:true` + policies `Public can view/upload complaint evidence`.
- Verified 2026-09-12: `rest/v1/complaints|locations|evidence|profiles|admin_access` `200`, `storage/v1/bucket` lists `complaint-evidence`, `rpc/create_complaint_ticket` inserts `POWER_OUTAGE` `0718f...` + `POTHOLE` `e88a...` with location/photo, RLS isolation (citizen2 sees `[]`, citizen `PATCH` `200 []`, admin `PATCH in_progress` `200`).

Demo accounts (password `Test1234!...`, `email_confirm:true` via `auth/v1/admin/users`):
- `citizen@test.local` `441c216f-d910-4e3e-a15f-74671e763257` / `citizen2@test.local` `04578579-8822-4e6e-8864-69d241d8b665`
- `admin@test.local` `98669f9c-36ce-4ef1-846a-7f66ea4cbe41` + `admin_access` lowercased `is_active:true`

## 6. Local verification (2026-09-12)
- `dashboard: npx tsc --noEmit` 0, `eslint` 0; `agent: npx tsc --noEmit` 0; `token-server: npx tsc --noEmit` 0
- `Set-Location agent; node --import tsx/esm --test tests/*.test.ts` 12/12; `Set-Location token-server; npx tsc --outDir .dev-dist; node --test tests/*.test.cjs` 4/4
- Live: `fetch health` `401` (needs apikey) after resume, `rest` with new keys `200`, `POST /rest/v1/rpc/create_complaint_ticket` `200`, `storage upload` `200`, `admin patch` propagates to citizen read, `token-server` `127.0.0.1:3002` recompiled and `POST /token` with citizen JWT → `200` room `effi-...`.

## 7. How to run locally
- `token-server`: `npx tsc --outDir .dev-dist` then `node scripts/dev.cjs` (or `pnpm run dev` if pnpm available) → `http://127.0.0.1:3002/token`
- `dashboard`: `pnpm run dev` (or `npm run dev`) → `http://localhost:3000`; set `TOKEN_SERVER_URL` accordingly
- `agent`: `pnpm run dev` (needs `GEMINI/DEEPGRAM/CARTESIA` + LiveKit + Supabase secret)
- `mobile`: `pnpm exec expo start --dev-client` after one `eas build --profile development --platform android` for JS reloads

## 8. Teacher demo (4 min, `docs/WEB_MVP_TEST_PLAN.md:105`)
1. Explain voice → location/photo → ticket.
2. Open citizen (`citizen@test.local`) + admin (`admin@test.local`) in separate browser profiles.
3. Citizen: `/` → pick `POTHOLE` → `Start voice report` (Chrome/Edge, `https`/localhost) → share location → upload photo → receive `EFF-...` → `View your ticket`.
4. Admin: `/admin` → feed shows ticket (without reload) → open detail → change `In Progress`.
5. Citizen: `/requests` shows status live (no reload). Emphasize workflow, not municipal repair. Keep backup recording.

Acceptance gate (`docs/WEB_MVP_TEST_PLAN.md:81`): 3 consecutive `POTHOLE` runs + 1 `POWER_OUTAGE` + mic/location/photo denied flows, exactly one ticket per call, receipt survives refresh.

## 9. Known deferred / not done
- No new categories/gamification/analytics/image diagnosis (deferred per plan).
- `supabase/migrations` deployment state not inspected via `pg_publication` in prod; run only after checking `supabase_realtime` pubs.
- Hosted `TOKEN_SERVER_URL` still local for dev — set Vercel URL for deployed dashboard.
- `mobile` web script alone not compatible (uses native LiveKit/WebRTC); browser flow is `dashboard` only.

## 10. Quick checks if demo fails
- `nslookup lmtgimyklueosoywasyr.supabase.co` → should resolve `104.18...`; if `ENOTFOUND` project paused.
- `rest` with publishable/secret → `401 Invalid` means truncated key — copy full from Settings → API Keys.
- `storage/v1/bucket` `[]` → bucket deleted — re-run bucket SQL in §4.
- `rpc` `42501 violates RLS` → `SUPABASE_SERVICE_ROLE_KEY` is `anon` not `secret`.
- `token-server` `EADDRINUSE` → kill stale `node scripts/dev.cjs`.
- `geolocation` needs `https`/localhost; `microphone` needs `getUserMedia` permission.

## 11. References
- `docs/WEB_MVP_TEST_PLAN.md:1`, `docs/IMPLEMENTATION_PROGRESS.md:1`, `PROJECT.md:1`, `README.md:1`
- Expo dev builds, LiveKit RPC/tools, Geolocation/Secure Contexts docs linked in plan
