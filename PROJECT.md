# Effi India architecture and development

## Current services

- `mobile/`: Expo citizen client. Supabase authentication, complaint feeds, native LiveKit voice, location and photo actions.
- `agent/`: long-running LiveKit worker. Deepgram Nova 3 transcription, Gemini 2.5 Flash via the OpenAI-compatible SDK, Cartesia Sonic 3 speech, Silero VAD, and complaint tools.
- `dashboard/`: Next.js admin UI. The next milestone extends it with citizen web routes; those routes are not implemented yet.
- `token-server/`: authenticated LiveKit token endpoint. Every new request creates a fresh server-generated room and participant identity. Reconnect an active call with the existing connection details; requesting a new token starts a new call.
- `supabase/`: database migrations. Inspect the target database's migration state before applying changes.

## Complaint data contract

1. The citizen selects SANITATION, POTHOLE, or POWER_OUTAGE. The token server verifies their Supabase access token and signs category, language, user identity and session metadata into the LiveKit token.
2. The agent obtains the complaint description by conversation. Spoken addresses are not used as authoritative coordinates.
3. The agent invokes `effi.provide_location`. The client asks for device/browser location with permission and returns coordinates, nullable sensor values, and a millisecond timestamp.
4. Sanitation and potholes require `effi.provide_photo` after location. The client uploads evidence to the `complaint-evidence` Supabase bucket and returns its public URL. Power outages do not request photos.
5. The agent calls `create_complaint_ticket` using its server-only service role. The existing SQL function writes the complaint, location, evidence reference and transcript in one transaction.
6. Admin data is protected by server authorization and database RLS; Realtime updates the feed. Citizen reads must remain scoped by ownership.

RPC results use `ok`, `denied`, `cancelled`, or `error`. A successful location includes `location`; a successful photo includes `photoUrl`. Location timeout is currently 20 seconds and photo timeout is 45 seconds. Browser handling and expired-action recovery are upcoming work.

## Retry behavior

One voice call represents one complaint. The ticket identifier is derived from the verified user ID and server-created room name. The database's existing unique `ticket_number` constraint prevents repeated calls or competing workers from creating a second ticket for that operation. After an RPC error, the agent looks up only the exact ticket belonging to that user and returns it if it exists. Failed writes do not produce successful receipts.

This relies on the checked-in transaction and unique constraint also being present in the target database. Local mocked tests are not proof of their deployment. A new call gets a new room and therefore a new ticket; semantic duplicates across separate calls are outside MVP scope. Legacy tokens from the previous deterministic-room endpoint should expire before validating this behavior with the updated agent and token server.

Evidence currently uses the mobile-compatible category/room/file Storage path. Strict URL/object ownership validation and Storage-policy review remain work for the evidence milestone; do not describe current public evidence URLs as private storage.

## Commands

Run each command in its service directory:

| Service | Develop | Verify |
| --- | --- | --- |
| agent | `pnpm run dev` | `pnpm run typecheck`, `pnpm run test`, `pnpm run build` |
| dashboard | `pnpm run dev` | `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run build` |
| token-server | existing Vercel function workflow | `pnpm run typecheck`, `pnpm run test` |
| mobile | `pnpm exec expo start --dev-client` | `pnpm exec tsc --noEmit` and device smoke tests |

The token-server regression script compiles into ignored `.test-dist/` before running Node tests. Agent tests use the existing tsx dependency and Node test runner. Tests never load `.env.local` or intentionally contact AI/database providers.

To build the first mobile development client from `mobile/`, use `pnpm dlx eas-cli build --profile development --platform android`, install the resulting APK, then start Metro with `pnpm exec expo start --dev-client`. This cloud-build command is a manual setup step and has not been run as part of implementation. Compatible JavaScript edits can reload without another APK build; native changes still need a rebuild.

## Configuration and demo checks

Keep provider credentials and the Supabase service-role key in server-only environment files. Only public client configuration belongs in Expo/Next public variables. Never put room tokens in query strings in the new web UI.

Configure Supabase redirect URLs for the actual localhost/hosted web callback. Verify a citizen account and a separate authorized admin account, table ownership policies, evidence uploads and Realtime before rehearsing. Use HTTPS for the hosted browser demo and localhost for local development.

The working tree already contained changes to the Deepgram patch, dashboard workspace configuration, mobile EAS configuration, and agent workspace configuration. Preserve those changes. The installed Deepgram 1.0.50 source includes the removed patch's baseUrl support and stream-loop condition, but a clean dependency installation has not been verified.
