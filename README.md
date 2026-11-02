# CivilHub

A construction job and financial workspace for five Malaysian companies. React 19, Vite, React Router, Supabase Auth/PostgreSQL/Storage, Recharts, Lucide and Leaflet.

## Run locally

Requires Node 22.13+.

```sh
npm ci
npm run dev
```

Create `.env.local` beside `package.json`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_DEMO_MODE=false
```

Vite loads environment settings from the project root even though the frontend is in `client/`. Restart after environment changes. The legacy `VITE_SUPABASE_ANON_KEY` name is accepted as a fallback. `.env.local` is ignored by Git. Never put a service-role/secret key into VITE\_ variables.

The normal default address is http://127.0.0.1:5173. If that port is occupied, use the Local URL printed by Vite.

## Real login and administrator setup

The default application mode uses Supabase Auth and requires a real session. It no longer accepts the demo credentials or displays demo records in a live workspace.

First-administrator setup is reserved in `civilhub_private.admin_setup` for an explicitly approved email. This reservation is private database configuration and is not bundled into the frontend or stored in Git. Onboarding requires the corresponding **verified Supabase Auth user**; changing JWT metadata or typing a different email in a form cannot claim the reservation.

The administrator chooses a password privately using either:

1. The app's **First-time administrator setup** form, followed by email confirmation; or
2. Supabase Dashboard → Authentication → Users → Add user, where the project owner creates the approved account with a private password and confirms that user's email.

Then sign in to CivilHub and choose **Create workspace**. The server atomically creates the profile, workspace, admin membership, five companies and Sunway client. The operation is idempotent for the same administrator. No demo financial records are imported.

Email/password login, show/hide password, session restoration, local sign-out, reset email and password-recovery screens are implemented. Passwords are sent only to Supabase Auth over HTTPS; they are not stored in application tables or source code.

### Email confirmation and recovery redirects

In Supabase Dashboard → Authentication → URL Configuration, add the exact callback URLs used by the app:

```text
http://127.0.0.1:5173/auth/callback
http://localhost:5173/auth/callback
http://127.0.0.1:5175/auth/callback
```

Set the Site URL to your main application address. For a hosted deployment, also add its exact HTTPS `/auth/callback` URL and set the production Site URL. These settings are required for confirmation/reset links to return to the correct app. The developer MCP OAuth callback is separate from application authentication.

Supabase's built-in email delivery has provider restrictions/rate limits. Configure a production SMTP provider before relying on registration/reset emails for users outside your project's permitted recipients. Creating the first user directly in the Dashboard avoids depending on signup email delivery; password reset still requires correctly configured email delivery and redirect URLs.

## Live data

- `services/auth.tsx` guards all workspace screens, restores sessions and clears cached records on sign-out/account changes.
- `services/cloud-repository.ts` reads/writes records through authenticated Supabase queries. RLS is authoritative; staff cannot write even if they bypass UI controls.
- All pages derive their financial totals from the same server-confirmed workspace snapshot. Amounts are represented as integer sen in the UI and exact numeric values in PostgreSQL.
- Job IDs/numbers and client creation are handled in a transactional server function. A workspace row lock prevents concurrent job-number collisions, and repeated create requests with the same UUID do not duplicate a job.
- Expenses/overheads save to PostgreSQL. Original job values remain unchanged by expenses, and negative balances are supported.
- Documents use the private `job-documents` bucket, authenticated download, workspace-scoped paths and metadata. PDF/JPG/PNG files are limited to 5 MB, with client-side file-signature checks and Storage type/size limits.
- Delete operations remove database records and document objects. If object cleanup fails after a committed database deletion, the UI shows a warning; an administrator must remove the remaining orphaned stored files. Background retry processing is not implemented.
- Records are loaded on sign-in/reload and refreshed when the window regains focus. This is not a realtime subscription. Pagination is used while loading large datasets.
- Browser-local sample data is never automatically migrated into a live account.

## Database migrations

Both migrations are applied to the configured Supabase project:

- `supabase/migrations/20261102183943_civilhub_foundation.sql`: nine public application tables, exact money, composite foreign keys, tenant isolation, RLS, restricted authenticated grants and private document storage.
- `supabase/migrations/20261102185621_live_auth_and_jobs.sql`: verified administrator reservation, stable company codes, server-side job counters and transactional create/edit RPC.

Supabase Auth owns password hashing and sessions. Public user profiles do not store passwords. Anonymous callers cannot read business tables. Company/workspace identity and audit columns cannot be edited directly by browser clients. Membership administration/inviting additional staff remains a future server-side feature; the current UI is for the approved administrator and existing workspace memberships.

Applied migrations are immutable. Add a new migration for subsequent changes; do not rerun or modify these files on the connected project.

## Optional isolated demo

For sample records without a live database, explicitly set `VITE_DEMO_MODE=true` and restart. This uses the separate `demo-repository.ts` and `demo-files.ts` browser-only implementation. Demo login uses `demo@civilhub.my` / `civilhub123`; it is not a Supabase account.

Demo records use localStorage and files use IndexedDB. They do not sync between devices or domains. Restore-sample/start-empty actions exist only in demo mode and cannot reset live records.

## Verification

```sh
npm test
npm run build
```

`tests/sql/bootstrap-local.sql` is **local-test-only** scaffolding for an isolated PostgreSQL cluster. Never apply it to a hosted Supabase database. The SQL tests exercise workspace isolation, staff/admin permissions, document policies, verified admin approval, exact money, recurrence uniqueness, transactional client/job creation, idempotency and rollback. Test records are rolled back.

Browser authentication/cloud integration checks use a local Vite server on port 5175 and installed Chrome:

```sh
npm run dev -- --port 5175 --strictPort
# In another terminal:
node tests/browser-auth-cloud.mjs
```

This test mocks Supabase services: it sends no emails and creates no real Auth users. It covers protected routes, sign-up confirmation, login failures/success, onboarding, persisted CRUD, private files, reports, logout isolation, recovery and mobile layout. A real-user email confirmation and password are intentionally completed privately by the account owner.

The separate demo browser workflow requires a demo-mode server:

```sh
VITE_DEMO_MODE=true npm run dev -- --port 5176 --strictPort
# In another terminal:
CIVILHUB_BASE_URL=http://127.0.0.1:5176/ node tests/browser-smoke.mjs
```

## Netlify and backend hosting

`netlify.toml` builds `dist/` and includes SPA rewrites. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_DEMO_MODE=false` in Netlify's project environment and rebuild. Add the deployed callback URL in Supabase Auth settings.

The live frontend uses Supabase's Auth/Data/Storage APIs and PostgreSQL functions; a separate Express server is not required for these implemented operations. `server/` is an optional Express 5/serverless-http scaffold. Its unimplemented API endpoints fail closed with 501 and are not used by the live frontend. No secret/service-role key is needed in the browser or for the implemented user-scoped operations.

Job value is contracted value, not cash collected. Estimated profit is not cash flow. Consolidated reports count shared overhead once; company reports exclude unallocated shared overhead. Maps use Leaflet/OpenStreetMap, curated Malaysian suggestions and manual pinning rather than Google Places Autocomplete.
