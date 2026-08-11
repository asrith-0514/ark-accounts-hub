## ARK Flow Master — Accounts Payable Production Hardening

Scope is strictly Accounts Payable (suppliers, purchase bills, payments). No inventory, sales, POS, PO/GRN, CRM, expenses, bank rec, payroll, HSN, TDS, RCM, multi-company/branch/currency, multi-bill payment allocation. Existing UI shell, navigation, and features are preserved.

---

### 1. Database invariants (migration)

Enforce financial rules at the DB so the app cannot corrupt data even with a bad client.

- `payments`: CHECK `amount > 0`; trigger `enforce_payment_invariants` on INSERT/UPDATE:
  - Load target bill (row lock), sum existing payments (excluding current id on UPDATE), reject if `sum + NEW.amount > bill.grand_total + 0.01`.
  - Reject if `NEW.payment_date < bill.invoice_date`.
  - Auto-set `bill.workflow_status` and legacy `status` to `paid`/`partially_paid`/prior state after each change; recompute `outstanding`.
- `bills`: CHECK `subtotal >= 0`, `discount >= 0`, `discount <= subtotal`, `gst >= 0`, `other_charges >= 0`, `grand_total >= 0`, `due_date >= invoice_date`. Trigger: block UPDATE that lowers `grand_total` below `sum(payments)`.
- Duplicate guard: partial unique index `bills(supplier_id, lower(invoice_number)) WHERE deleted_at IS NULL`.
- RLS: DELETE on `payments` and `bills` restricted to owner (already partially in place — verify + tighten). Accountants can INSERT/UPDATE non-terminal bills only; approved/paid bills locked from edit except owner.

### 2. Audit trail (DB triggers)

Generic `public.audit_log` table (event, table, row_id, actor_id, actor_name, before jsonb, after jsonb, at). Triggers on `suppliers`, `bills`, `payments`, `bill_documents`, `company_settings`, `bill_workflow_events` writing INSERT/UPDATE/DELETE rows automatically. Existing `activities` table kept for user-facing feed; audit_log is the immutable record (append-only RLS, no UPDATE/DELETE for anyone incl. owner). Activity page gains an "Audit Log" tab (owner only).

### 3. Approval workflow UI

Complete the Draft → Pending Verification → Verified → Waiting Approval → Approved → Partially Paid → Paid → Closed pipeline (already modeled in `bill_workflow_events`).

- New `BillWorkflowPanel` component in bill detail drawer: vertical timeline of `bill_workflow_events` + action buttons gated by role and current status.
- Reject action opens dialog requiring comment; writes event with `to_status='draft'` (or `rejected` sub-state stored in comment) + notification.
- Server functions `transitionBill({billId, to, comment})` with server-side guard table of allowed transitions per role. DB trigger validates same transition table so client bypass is impossible.
- Payments automatically move Approved → Partially Paid → Paid (already handled in payment trigger). Owner-only "Close" action moves Paid → Closed.

### 4. Bill form validation

Zod schema in `_authenticated.bills.tsx`:
- GSTIN regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$` (validated on supplier form too).
- Invoice number: non-empty, ≤ 50 chars, alphanumeric + `-/`.
- `discount ≤ subtotal`, `gst ≥ 0`, `|roundOff| ≤ 10`, `dueDate ≥ invoiceDate`.
- Duplicate check hits DB (unique index) with friendly AlertDialog before submit.

Payment form: `amount > 0`, `amount ≤ outstanding`, `paymentDate ≥ invoiceDate`, ≤ today.

### 5. Supplier Statement

Upgrade `_authenticated.suppliers.$id.tsx` ledger:
- Rows: Opening Balance → Bills + Payments interleaved by date → Closing Balance footer.
- Columns: Date, Type, Reference (invoice#/payment ref), Debit, Credit, Running Balance, Status, Remarks.
- Export buttons: PDF (jspdf-autotable with company header/logo from `company_settings`), Excel (xlsx), CSV, Print (`@media print`).

### 6. Reports (`_authenticated.reports.tsx`)

Tabs limited to AP set: Outstanding, Supplier Ledger, Supplier Statement, Payment Report, Overdue, Aging (0-30/31-60/61-90/90+), GST Summary, Monthly Purchase, Top Outstanding Suppliers, Top Payments. Each supports PDF/Excel/CSV/Print with company header. All queries server-side aggregated (see §8).

### 7. Dashboard (`_authenticated.dashboard.tsx`)

AP-only widgets: Total Outstanding, Today's Payments, MTD Payments, Bills Today, Bills MTD, Overdue Amount, Largest Outstanding Supplier, Largest Pending Invoice, Upcoming Due (7d), Recent Payments (10), Recent Activities (10), Outstanding Trend (area 12mo), Monthly Payments (bar), Monthly Purchases (bar), Aging pie. All driven by SQL RPCs (§8), not full table loads.

### 8. Performance

- Server-side RPCs: `ap_dashboard_stats()`, `ap_aging_buckets()`, `ap_monthly_series(months int)`, `supplier_statement(supplier_id, from, to)`, `paginated_bills(...)`, `paginated_payments(...)`, `paginated_suppliers(...)` returning `{rows, total}`.
- Bills/Payments/Suppliers pages: switch from full list to paginated (25/page) with URL search params for page/search/status/date.
- Global store keeps only lookup maps (suppliers by id) and reference data; heavy lists moved to route loaders with TanStack Query keys.
- Indexes: verify `bills(supplier_id, invoice_date desc)`, `bills(due_date) WHERE deleted_at IS NULL`, `bills(workflow_status)`, `payments(bill_id)`, `payments(supplier_id, payment_date desc)`, `audit_log(table_name, row_id)`.

### 9. Security pass

- Re-run linter after migration. Verify RLS on `audit_log` (INSERT only via triggers, SELECT owner-only, no UPDATE/DELETE), `bill_workflow_events` (INSERT via server fn only).
- Storage: `bill-documents` bucket policies scoped to `bill_id` folder; downloads via signed URLs (5 min TTL); MIME whitelist (pdf/jpg/png/webp), 20MB cap enforced server-side in upload server fn.
- File upload server fn validates magic bytes, not just extension.
- Owner-only: delete payments/bills/suppliers, close bills, edit approved bills, view audit log.

### 10. UX

Loading skeletons on all list pages, confirm dialogs on destructive actions (already present — audit for coverage), inline zod error messages, sticky table headers, keyboard: `Cmd/Ctrl+K` global search (already planned — kept, AP scope only), `n` new bill on bills page, `Esc` closes dialogs. Empty states with primary CTA.

### 11. Backup & recovery doc

Add `docs/BACKUP.md`:
- Lovable Cloud automated daily Postgres backups (retention window).
- Manual export: Cloud → Advanced settings → Export data (schema + rows).
- Storage: script using service key to mirror `bill-documents` to local/S3 weekly.
- Recovery: restore SQL dump into a fresh project, re-upload storage, rotate keys, update `.env`.
- RPO/RTO targets and quarterly restore-drill checklist.

### 12. Post-implementation audit

After rollout: run typecheck, security scanner, Playwright smoke (login → create bill with discount+roundoff → workflow transition path → record partial + final payment → attempt overpayment (must fail) → statement PDF → dashboard KPIs). Deliver readiness report (bugs, security, accounting, verdict).

---

### Rollout order

1. Migration (invariants + audit_log + triggers + RPCs + indexes).
2. Server functions (`transitionBill`, `recordPayment`, `uploadBillDocument`, paginated fetchers, statement RPC wrappers).
3. Bill form + Payment form validation + duplicate dialog.
4. Workflow panel (timeline + action buttons).
5. Statement + Reports export pipeline (shared `pdfHeader.ts`, `xlsxExport.ts`).
6. Dashboard rewrite to RPCs.
7. Pagination on Bills/Payments/Suppliers.
8. Storage signed URLs + upload validation.
9. UX polish (skeletons, shortcuts, empty states).
10. Docs + final audit.

### Out of scope (explicitly)

Inventory, Sales, POS, PO/GRN, CRM, expenses, bank reconciliation, payroll, manufacturing, HSN line items, TDS, RCM, multi-company/branch/currency, multi-bill payment allocation.
