# Known Limitation: Reports/Dashboard Data Loading at Scale

**Logged:** During Step 6 (Reports) implementation, August 2026

**Issue:** `refetchAll()` in `store.tsx` loads all bills, payments, and suppliers into client memory on app boot via `select("*")` with no pagination. Supabase/PostgREST defaults to a 1,000-row cap per query.

**Impact:** Once total active bills OR payments exceed 1,000 rows, the client will silently only load the first 1,000, and Dashboard KPIs, Reports, and Aging Analysis will reflect a partial dataset without any visible error.

**Current status:** Not a problem — current volume is well under this threshold (55 suppliers, single-digit bills as of testing).

**Recommended fix, when needed:**
1. Move reporting calculations (Aging, GST summaries, supplier balances) into PostgreSQL views or RPC functions so Postgres does the aggregation server-side.
2. Switch `/reports` and `/dashboard` to on-demand queries per tab/view instead of loading the entire dataset into memory at boot.

**Trigger to revisit:** When bills or payments approach ~700-800 rows (leaving buffer before hitting the 1,000 cap), or noticeably before any planned growth event (e.g. onboarding many new suppliers/bulk historical data import).
