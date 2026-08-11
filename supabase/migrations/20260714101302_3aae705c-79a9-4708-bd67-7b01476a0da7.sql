
DROP POLICY IF EXISTS "Auth insert activities" ON public.activities;
DROP POLICY IF EXISTS "Auth read activities" ON public.activities;
CREATE POLICY "Staff insert activities" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff read activities" ON public.activities FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Auth insert supplier_history" ON public.supplier_history;
DROP POLICY IF EXISTS "Auth read supplier_history" ON public.supplier_history;
CREATE POLICY "Staff insert supplier_history" ON public.supplier_history FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff read supplier_history" ON public.supplier_history FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));
