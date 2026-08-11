
-- Extend bills for new accounting model + workflow + soft delete
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_value numeric,
  ADD COLUMN IF NOT EXISTS round_off numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total numeric,
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Backfill
UPDATE public.bills
   SET taxable_value = COALESCE(taxable_value, subtotal),
       grand_total   = COALESCE(grand_total, total),
       workflow_status = CASE
         WHEN status = 'paid' THEN 'paid'
         WHEN status = 'partial' THEN 'partially_paid'
         WHEN status = 'overdue' THEN 'overdue'
         ELSE 'approved'
       END
 WHERE taxable_value IS NULL OR grand_total IS NULL;

ALTER TABLE public.bills
  ALTER COLUMN taxable_value SET NOT NULL,
  ALTER COLUMN grand_total SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bills_supplier_invoice_date ON public.bills(supplier_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON public.bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_workflow_status ON public.bills(workflow_status);
CREATE INDEX IF NOT EXISTS idx_bills_deleted_at ON public.bills(deleted_at);
CREATE INDEX IF NOT EXISTS idx_payments_supplier_date ON public.payments(supplier_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON public.payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_activities_at ON public.activities(at DESC);

-- Extend company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS owner_name text NOT NULL DEFAULT 'Thatavarthi Sivannarayana',
  ADD COLUMN IF NOT EXISTS gst_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pan_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS financial_year_start smallint NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS default_credit_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS default_gst_rate numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS reminder_days jsonb NOT NULL DEFAULT '[0,1,3,7]'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_channels jsonb NOT NULL DEFAULT '{"email":false,"whatsapp":false,"push":false,"inApp":true}'::jsonb;

-- Extend bill_documents with uploader/replace history
ALTER TABLE public.bill_documents
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS uploaded_by_name text,
  ADD COLUMN IF NOT EXISTS replaced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bill_documents_bill_id ON public.bill_documents(bill_id);

-- Workflow events table
CREATE TABLE IF NOT EXISTS public.bill_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  user_id uuid,
  user_name text,
  comment text,
  at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bill_workflow_events TO authenticated;
GRANT ALL ON public.bill_workflow_events TO service_role;

ALTER TABLE public.bill_workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read workflow events"
  ON public.bill_workflow_events FOR SELECT
  TO authenticated
  USING (private.is_staff(auth.uid()));

CREATE POLICY "Staff can insert workflow events"
  ON public.bill_workflow_events FOR INSERT
  TO authenticated
  WITH CHECK (private.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_bill_workflow_events_bill_at ON public.bill_workflow_events(bill_id, at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_workflow_events;
