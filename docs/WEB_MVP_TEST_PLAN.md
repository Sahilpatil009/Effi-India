# Effi India: web MVP and testing plan

Reviewed: 11 September 2026. This is an implementation plan, not a claim that the live system has passed end-to-end testing.

## Objective

Make everyday debugging possible in a browser and deliver a convincing college demonstration: a citizen speaks a civic complaint, shares device location and evidence, receives a ticket, and watches its status change after an administrator acts.

## Verified starting point

- Mobile: Expo app with authentication, voice interaction, location/photo RPC handlers, own complaints, and nearby complaints.
- Agent: LiveKit with Deepgram transcription, Gemini 2.5 Flash through an OpenAI-compatible client, Cartesia speech, complaint tools, and Supabase persistence.
- Dashboard: Next.js 16 with admin authorization, complaint feed, Realtime subscriptions, evidence/location/transcript details, and status updates.
- Token server: verifies Supabase access tokens and issues LiveKit tokens.
- SQL migrations define complaint ownership, admin access, normalized records, and Realtime publication changes. Their deployment state has not been verified.
- TypeScript checks passed for agent, mobile, dashboard, and token-server. Dashboard lint passed. No automated test suite was found in the inspected service manifests/source inventory.
- The token-server pnpm command was blocked by its dependency build-script configuration; its installed TypeScript compiler passed when invoked directly.
- No production build, authenticated browser flow, live AI call, or database integration test was performed in this review.
- PROJECT.md is referenced but missing; README model information differs from the agent implementation.
- Existing uncommitted changes were present before this review and must be preserved.

## Architecture decision

Extend dashboard/ into the shared Next.js web application. Keep its directory name for now. Reuse the agent, token service, Supabase schema, and admin UI.

Proposed routes:

| Route | Purpose |
| --- | --- |
| / | Citizen home with three category cards and a clear start action |
| /login and /auth/callback | Shared authentication with role-aware redirects |
| /report | Browser voice session, live transcript, location and evidence actions |
| /requests | Citizen's own tickets and current statuses |
| /requests/[id] | Ticket details, evidence, and current progress |
| /admin | Existing admin dashboard moved from / |

Update auth proxy, login callbacks, server-action revalidation paths, and admin links together. Keep server-side admin guards and database RLS. A citizen must not gain admin access by navigating directly to a URL.

Use LiveKit's browser client/React components for audio and RPC. Implement browser adapters for effi.provide_location and effi.provide_photo using the existing payload contracts. Register handlers before the agent can request them. Browser coordinates must populate the expected nullable fields and timestamp; keep location device-derived. Upload evidence to Supabase Storage and return the compatible URL. Validate the bucket and ownership path on the server.

Keep token issuance server-side and reuse the existing token endpoint first; test its browser request/auth behavior. Do not put provider or service-role secrets in the client. Keep room tokens in memory rather than URLs.

This is a browser implementation of the citizen experience, not a direct copy of native screens: mobile imports native LiveKit/WebRTC, audio-session, and waveform components. The Expo web script alone does not establish compatibility.

## MVP scope and demonstration value

| Priority | Feature | Visible result |
| --- | --- | --- |
| Required | Voice complaint with live transcript | Teachers can see speech become structured information |
| Required | Three existing categories | Pothole, sanitation, and power outage follow distinct evidence rules |
| Required | Location and photo action cards | Agent requests visibly trigger real browser actions |
| Required | Ticket receipt after confirmed persistence | Citizen sees a real ticket number and complaint summary |
| Required | Live admin feed and status update | Ticket moves from citizen report to administrative action |
| Required | Citizen status tracking | Status becomes visible to the reporting citizen |
| After core passes | Polish and second-language demonstration | Clear listening/thinking/speaking states and a rehearsed multilingual call |
| Optional | Nearby issues or small map preview | Add only if the main flow is already stable |

Rehearse English and Hindi first. Add Marathi to the claimed demo scope only after live transcription and speech quality pass. Provider configuration and prompts are not proof of language quality.

Defer new categories, gamification, push notifications, advanced analytics, automatic image diagnosis, duplicate detection, and complex municipal routing. The selected category is currently user-selected; do not present it as automatic AI classification. An admin changing a status demonstrates workflow, not actual municipal repair.

## Ordered implementation milestones

1. **Stabilize the contract.** Document the real setup and missing architecture guidance. Verify test accounts, deployed migrations, storage and Realtime. Fix token-server tooling. Use unique server-generated room/session identities and remove or authorize caller-supplied room overrides. Add an idempotent registration key so repeated tool calls/retries return one ticket. Review the existing removed Deepgram patch before reinstalling dependencies.
2. **Build one vertical slice.** Add citizen routing/auth and a minimal browser call. Start with POWER_OUTAGE: speech, device location, one persisted complaint, and a ticket receipt. This avoids photo upload complexity while establishing the whole path.
3. **Complete the evidence flow.** Add pothole/sanitation upload and preview, permission-denied/cancelled/error states, and retry handling. Existing agent RPC timeouts are 20 seconds for location and 45 seconds for photos: test slow user actions and SDK limits before choosing a timeout strategy. Ignore expired responses; never silently reuse evidence from another session.
4. **Close the feedback loop.** Add My Requests and detail pages. Reuse the admin feed and status controls. Publish a structured registration result to the citizen UI after persistence; do not parse a spoken ticket number. Verify the receipt survives a page refresh through the saved record. Show current progress; add a history table only if displaying actual timestamped status history.
5. **Polish and rehearse.** Add responsive layout, readable transcript, call states, large action buttons, loading/error states, and visible completion. Run the acceptance matrix below and prepare a short backup recording of a real successful run.

Complete and verify each milestone before expanding scope. Estimate scheduling after the first live browser call exposes the remaining integration work.

## Testing plan

### Fast checks during development

- Run TypeScript checks in all affected services and dashboard lint.
- Add targeted automated tests around token validation, category/evidence rules, RPC result parsing, and idempotent persistence. Mock external AI and network calls for these tests.
- Add browser tests for navigation, role access, permission outcomes, upload UI, receipt rendering, and request tracking. Use controlled location/media fixtures; clearly distinguish mocked tests from live validation.
- Run a production build before release. Keep native smoke tests for mobile audio/camera/location; browser success does not prove native compatibility.

### Integration and acceptance matrix

| Case | Pass condition |
| --- | --- |
| Power outage | Real voice call + device location creates exactly one owned ticket without asking for a photo |
| Pothole and sanitation | Registration is blocked until device location and valid photo evidence exist |
| Identity and category | User identity comes from verified auth; tool calls cannot change the selected category |
| Microphone denied | Clear recovery instructions; no indefinite connecting state |
| Location denied/unavailable | Honest explanation and retry; no invented coordinates or successful ticket |
| Photo cancelled/invalid/upload failed | Recoverable state; no success claim and no incomplete ticket |
| Slow RPC and disconnect | Pending actions settle or expire; retry does not attach stale evidence |
| Repeated submit/reconnect | Exactly one ticket for the same registration operation |
| Token API | Missing/expired token rejected; invalid category rejected; provider failure handled; room access isolated |
| Ownership | Citizen A cannot read citizen B's private records or execute admin mutations, including direct API requests |
| Persistence | Ticket, location, evidence, and transcript agree; failed creation leaves no partial complaint |
| Realtime | New ticket appears in admin without reload; admin status appears for citizen without reload |
| Refresh and session expiry | Ticket remains accessible after refresh; expired login has a clear recovery path |
| Language | Actual speech recognition, response language, and English admin summary pass rehearsed examples |
| Presentation | Chrome/Edge laptop layout and narrow viewport are readable; audio does not continue after ending a call |

Use dedicated demo accounts and disposable test data. Inspect existing migration state before applying SQL; do not blindly replay migrations on the current database. Rehearse microphone and device-location permissions on the presentation laptop. Use localhost during development and HTTPS for hosted testing: browser geolocation requires a secure context. Report low location accuracy honestly.

Acceptance gate: three consecutive complete runs of the primary demo scenario with no duplicate ticket, no manual database repair, and working citizen/admin status updates. Also pass one power-outage run, one sanitation run, and the permission/error tests. Record measured timings; a useful target is feed/status visibility within five seconds on the demo network, not a claimed guarantee.

## Teacher demo: approximately four minutes

1. Explain the problem: citizens can report issues by speaking in a familiar language.
2. Open a citizen session and a separate admin browser profile to keep roles isolated.
3. Select pothole, describe a prepared scenario, show the transcript, and share device location and an appropriate demo photo.
4. Show the persisted ticket and switch to the admin feed. Open the summary, evidence, and location.
5. Change the status to In Progress and show the citizen's updated ticket. Explain that this is an administrative workflow demonstration.

Use a clearly labeled demo complaint. Keep a recording of a real successful run available if the venue network or an AI provider fails; do not portray a recording or mocked session as live.

## Reduce mobile build friction immediately

mobile/eas.json currently has preview and production profiles but no development-client profile. Add one when implementing development setup, build/install it once, and use pnpm exec expo start --dev-client from mobile/ for compatible JavaScript changes. Native dependency/configuration changes still require rebuilding. Agent-side changes do not require rebuilding the mobile binary. Retain this path for native regression testing even after the web MVP exists.

## Primary references

- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- LiveKit browser RPC: https://docs.livekit.io/transport/data/rpc/
- LiveKit tools forwarded to browser: https://docs.livekit.io/agents/logic/tools/forwarding/
- Browser geolocation: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- Secure localhost contexts: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts
