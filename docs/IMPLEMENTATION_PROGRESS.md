# Web MVP implementation progress

## Milestone 1: local backend foundation

Implemented:

- Server-generated unique voice rooms and participant identities; client-supplied room names rejected.
- Validated language/name input, bounded auth verification, controlled auth-outage response, and non-cacheable token responses.
- Stable per-user/per-call ticket numbers with recovery after concurrent inserts or a lost RPC response, using the existing unique constraint.
- Coordinate bounds, photo-after-location enforcement, and clearing stale location/photo state when recollecting evidence.
- Node regression tests for token isolation, authorization failures, registration retries and category/evidence guards.
- Fixed token-server esbuild approval configuration and added test/typecheck commands.
- Added the mobile development-client EAS profile without removing the existing profiles.
- Restored PROJECT.md and corrected the README's model description.

Validation is recorded after the final checks below. Automated persistence tests simulate the database; no production data was written and no deployment or EAS build was started.

Outstanding integration gate: inspect deployed schema/unique constraint, storage policy and Realtime state; verify dedicated citizen/admin accounts and a real voice call. Do not claim milestone 1 is live-verified before those checks pass.

## Next milestone

Implement citizen web login/routing and the power-outage vertical slice inside dashboard/. Move the existing admin page to /admin, preserve role checks, and wire browser LiveKit audio/location to a persisted receipt. Then add photo evidence and My Requests, following WEB_MVP_TEST_PLAN.md.
