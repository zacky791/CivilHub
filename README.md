# CivilHub

An interactive construction job and financial management **demo** for five Malaysian companies. React 19, Vite, React Router, Recharts, Lucide and Leaflet. The UI follows the supplied reference with a light workspace, rounded cards and purple accents.

## Run

Requires Node 22.13+.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The sample workspace opens immediately. Log out to review the demo login: `demo@civilhub.my` / `civilhub123`.

```sh
npm test          # 21 calculation and persisted-workflow tests
npm run build    # strict TypeScript check and production Vite build
npm run preview  # serve the production build
node tests/browser-smoke.mjs # dev server on 5173 + installed Chrome required
```

## Demo capabilities

- Five companies, 15 editable sample jobs, sample direct costs and overheads.
- Company selection, new/edit/delete jobs, unique IDs, creatable clients, custom work types and status changes.
- Leaflet/OpenStreetMap pin selection, draggable markers, a curated Malaysian location list, manual addresses and Google Maps links. Map tiles need an internet connection. Suggestions are local, not global Places Autocomplete.
- Job dashboard with company groups, search, sorting, date/client/work filters and pagination.
- Expenses with add/edit/delete, receipt uploads, exact integer-sen calculations, original-value preservation and negative-balance warnings.
- Overheads with shared/company assignment, filters, attachment management, monthly/yearly totals and duplicate recurring-period checks. Recurrence is a recorded configuration; entries are manually added each period.
- Interactive filtered reports, company distribution, value/cost comparison, monthly trend, profitability, CSV download and print styles.
- PDF/JPG/PNG attachments up to 5 MB, basic signature validation, previews, downloads and confirmed deletion.
- Responsive navigation, activity feed, global search, toast feedback, empty states, restore samples and start-empty actions.

## Data and demo limitations

Records persist in **localStorage** under `civilhub:workspace:v1`; file blobs use **IndexedDB**. All views derive totals from the same saved records. Clearing browser data removes this demo's data. Files and records do not sync across devices. Exported JSON contains record data and file metadata; download file contents separately.

Sample data is isolated in `client/src/services/seed.ts`. No financial totals are hardcoded in components. Money is represented as integer sen with validated decimal parsing. Display uses MYR and DD/MM/YYYY with Asia/Kuala_Lumpur dates.

Demo login is simulated access to a local workspace, **not production authentication**. It initially opens as a demo administrator. Do not store real business records, secrets or personal documents here. Browser-local storage is intended for this demo only; multi-user concurrency, real account roles, server authorization and cross-device storage are deferred as requested.

Report dates select registered jobs and their cost entries by their own dates. Work-type filters affect jobs and direct expenses, while overhead remains company-wide. Company reports exclude unallocated shared overhead; consolidated reports include shared overhead once. Job value is contracted value, not cash collected, and estimated profit is not cash flow.

## Integration structure

- `client/src/services/repository.ts`: validated demo CRUD boundary used by all views. Replace this with an asynchronous authenticated repository and loading/error states when connecting the backend.
- `client/src/services/files.ts`: demo document storage boundary; replace with private Supabase Storage and signed URLs.
- `client/src/services/supabase.ts`: optional Supabase client factory. Environment variables are documented in `.env.example`. It is not activated by the demo.
- `server/`: Express 5 + serverless-http scaffold. `/api/health` reports that the database is disconnected. Other API routes return 501 until real services and JWT verification are implemented; they never silently accept production records.
- `supabase/migrations/0001_workspace_foundation.sql`: **unapplied** PostgreSQL foundation, exact numeric money, foreign keys, workspace isolation, RLS, admin writes/staff reads, private file policies and an explicit company/client onboarding RPC. Supabase Auth owns password hashing and sessions. Review and test this migration in a development Supabase project before use.
- `netlify.toml`: Vite client + Express serverless function configuration for the later integration. No old Render backend or credentials are included.

Before production integration: connect Supabase Auth and JWT verification; implement the authenticated repository; atomically allocate job numbers and clients on the server; add audit identities, paginated APIs, transaction boundaries and storage cleanup; test RLS as two independent users/workspaces; complete production upload validation and security/backup checks. Do not put a Supabase service-role key in VITE\_ variables.

## Deployment

This demo can be hosted as a static SPA. `npm run build` emits `dist/`. Netlify rewrites are included. `.openai/hosting.json` declares the private Sites demo; no hosted database is used. The integration scaffold and SQL have not been deployed as a production service.
