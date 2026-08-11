
REVOKE ALL ON FUNCTION public.enforce_payment_invariants()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_bill_grand_total_floor()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.write_audit_log()                 FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "System insert audit" ON public.audit_log;
CREATE POLICY "Actor insert audit" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id IS NULL OR actor_id = auth.uid());
