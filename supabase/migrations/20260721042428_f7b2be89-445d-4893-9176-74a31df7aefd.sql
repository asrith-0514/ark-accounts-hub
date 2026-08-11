
-- Soft-delete existing duplicates (keep earliest by created_at)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY supplier_id, lower(invoice_number)
           ORDER BY created_at, id
         ) AS rn
    FROM public.bills
   WHERE deleted_at IS NULL
)
UPDATE public.bills b
   SET deleted_at = now()
  FROM ranked r
 WHERE b.id = r.id AND r.rn > 1;

-- ---------------------------------------------------------------
-- 1. BILL VALIDATION (CHECK constraints)
-- ---------------------------------------------------------------
ALTER TABLE public.bills
  DROP CONSTRAINT IF EXISTS bills_subtotal_nonneg,
  DROP CONSTRAINT IF EXISTS bills_discount_nonneg,
  DROP CONSTRAINT IF EXISTS bills_discount_le_subtotal,
  DROP CONSTRAINT IF EXISTS bills_gst_nonneg,
  DROP CONSTRAINT IF EXISTS bills_other_nonneg,
  DROP CONSTRAINT IF EXISTS bills_grand_total_nonneg,
  DROP CONSTRAINT IF EXISTS bills_roundoff_bounded,
  DROP CONSTRAINT IF EXISTS bills_due_ge_invoice;

ALTER TABLE public.bills
  ADD CONSTRAINT bills_subtotal_nonneg      CHECK (subtotal >= 0),
  ADD CONSTRAINT bills_discount_nonneg      CHECK (discount >= 0),
  ADD CONSTRAINT bills_discount_le_subtotal CHECK (discount <= subtotal),
  ADD CONSTRAINT bills_gst_nonneg           CHECK (gst >= 0),
  ADD CONSTRAINT bills_other_nonneg         CHECK (other_charges >= 0),
  ADD CONSTRAINT bills_grand_total_nonneg   CHECK (grand_total >= 0),
  ADD CONSTRAINT bills_roundoff_bounded     CHECK (abs(round_off) <= 10),
  ADD CONSTRAINT bills_due_ge_invoice       CHECK (due_date >= invoice_date);

DROP INDEX IF EXISTS public.bills_supplier_invoice_unique;
CREATE UNIQUE INDEX bills_supplier_invoice_unique
  ON public.bills (supplier_id, lower(invoice_number))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS bills_supplier_date_idx    ON public.bills (supplier_id, invoice_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bills_due_date_idx         ON public.bills (due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bills_workflow_idx         ON public.bills (workflow_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payments_bill_idx          ON public.payments (bill_id);
CREATE INDEX IF NOT EXISTS payments_supplier_date_idx ON public.payments (supplier_id, payment_date DESC);

-- ---------------------------------------------------------------
-- 2. PAYMENT SAFETY
-- ---------------------------------------------------------------
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_positive;
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

CREATE OR REPLACE FUNCTION public.enforce_payment_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill        public.bills%ROWTYPE;
  v_paid_others numeric;
  v_paid_total  numeric;
  v_new_status  text;
  v_new_wf      text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO v_bill FROM public.bills WHERE id = OLD.bill_id FOR UPDATE;
    IF NOT FOUND THEN RETURN OLD; END IF;
    SELECT COALESCE(SUM(amount),0) INTO v_paid_total
      FROM public.payments WHERE bill_id = v_bill.id AND id <> OLD.id;
  ELSE
    SELECT * INTO v_bill FROM public.bills WHERE id = NEW.bill_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bill % not found', NEW.bill_id; END IF;
    IF v_bill.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot record payment against a deleted bill';
    END IF;
    IF NEW.payment_date < v_bill.invoice_date THEN
      RAISE EXCEPTION 'Payment date (%) cannot be earlier than invoice date (%)',
        NEW.payment_date, v_bill.invoice_date;
    END IF;
    IF NEW.payment_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'Payment date cannot be in the future';
    END IF;

    SELECT COALESCE(SUM(amount),0) INTO v_paid_others
      FROM public.payments
     WHERE bill_id = v_bill.id
       AND (TG_OP = 'INSERT' OR id <> NEW.id);

    IF (v_paid_others + NEW.amount) > (v_bill.grand_total + 0.01) THEN
      RAISE EXCEPTION 'Overpayment blocked: paid % + new % exceeds grand total %',
        v_paid_others, NEW.amount, v_bill.grand_total;
    END IF;

    v_paid_total := v_paid_others + NEW.amount;
  END IF;

  IF v_paid_total <= 0.005 THEN
    v_new_status := CASE WHEN v_bill.due_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END;
    v_new_wf     := CASE WHEN v_bill.workflow_status IN ('partially_paid','paid')
                         THEN 'approved' ELSE v_bill.workflow_status END;
  ELSIF v_paid_total + 0.01 >= v_bill.grand_total THEN
    v_new_status := 'paid'; v_new_wf := 'paid';
  ELSE
    v_new_status := 'partial'; v_new_wf := 'partially_paid';
  END IF;

  UPDATE public.bills
     SET status = v_new_status, workflow_status = v_new_wf, updated_at = now()
   WHERE id = v_bill.id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_invariants_iu ON public.payments;
DROP TRIGGER IF EXISTS trg_payment_invariants_d  ON public.payments;

CREATE TRIGGER trg_payment_invariants_iu
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_invariants();

CREATE TRIGGER trg_payment_invariants_d
  AFTER DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_invariants();

CREATE OR REPLACE FUNCTION public.enforce_bill_grand_total_floor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_paid numeric;
BEGIN
  IF NEW.grand_total = OLD.grand_total THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE bill_id = NEW.id;
  IF NEW.grand_total + 0.01 < v_paid THEN
    RAISE EXCEPTION 'Grand total (%) cannot be lower than payments already recorded (%)',
      NEW.grand_total, v_paid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bill_grand_total_floor ON public.bills;
CREATE TRIGGER trg_bill_grand_total_floor
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bill_grand_total_floor();

-- ---------------------------------------------------------------
-- 3. AUDIT LOG
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event       text NOT NULL,
  table_name  text NOT NULL,
  row_id      text,
  actor_id    uuid,
  actor_name  text,
  before_data jsonb,
  after_data  jsonb,
  at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read audit log" ON public.audit_log;
DROP POLICY IF EXISTS "System insert audit"   ON public.audit_log;

CREATE POLICY "Owners read audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "System insert audit" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS audit_log_table_row_idx ON public.audit_log (table_name, row_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_at_idx        ON public.audit_log (at DESC);

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name  text;
  v_row   text;
  v_before jsonb;
  v_after  jsonb;
BEGIN
  SELECT COALESCE(name, email, 'System') INTO v_name FROM public.profiles WHERE id = v_actor;
  IF v_name IS NULL THEN v_name := 'System'; END IF;

  IF TG_OP = 'INSERT' THEN
    v_row := (to_jsonb(NEW)->>'id'); v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := (to_jsonb(NEW)->>'id'); v_before := to_jsonb(OLD); v_after := to_jsonb(NEW);
  ELSE
    v_row := (to_jsonb(OLD)->>'id'); v_before := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_log (event, table_name, row_id, actor_id, actor_name, before_data, after_data)
  VALUES (TG_OP, TG_TABLE_NAME, v_row, v_actor, v_name, v_before, v_after);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'suppliers','bills','payments','bill_documents',
    'company_settings','bill_workflow_events'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()', t);
  END LOOP;
END $$;
