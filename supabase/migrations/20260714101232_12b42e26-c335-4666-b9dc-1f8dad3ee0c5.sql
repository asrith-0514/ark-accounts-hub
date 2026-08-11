
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','accountant'));
$$;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated;

-- user_roles
DROP POLICY IF EXISTS "Owners manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users read own roles or owners read all" ON public.user_roles;
CREATE POLICY "Owners manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner')) WITH CHECK (private.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users read own roles or owners read all" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'owner'));

-- profiles
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Users read own profile or owners read all" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR private.has_role(auth.uid(), 'owner'));

-- suppliers
DROP POLICY IF EXISTS "Auth insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Auth read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Auth update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Owners delete suppliers" ON public.suppliers;
CREATE POLICY "Staff read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Owners delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'owner'));

-- bills
DROP POLICY IF EXISTS "Auth insert bills" ON public.bills;
DROP POLICY IF EXISTS "Auth read bills" ON public.bills;
DROP POLICY IF EXISTS "Auth update bills" ON public.bills;
DROP POLICY IF EXISTS "Owners delete bills" ON public.bills;
CREATE POLICY "Staff read bills" ON public.bills FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff insert bills" ON public.bills FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff update bills" ON public.bills FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Owners delete bills" ON public.bills FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'owner'));

-- bill_documents
DROP POLICY IF EXISTS "Auth insert bill_documents" ON public.bill_documents;
DROP POLICY IF EXISTS "Auth read bill_documents" ON public.bill_documents;
DROP POLICY IF EXISTS "Auth update bill_documents" ON public.bill_documents;
DROP POLICY IF EXISTS "Owners delete bill_documents" ON public.bill_documents;
CREATE POLICY "Staff read bill_documents" ON public.bill_documents FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff insert bill_documents" ON public.bill_documents FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff update bill_documents" ON public.bill_documents FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Owners delete bill_documents" ON public.bill_documents FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'owner'));

-- payments
DROP POLICY IF EXISTS "Auth insert payments" ON public.payments;
DROP POLICY IF EXISTS "Auth read payments" ON public.payments;
DROP POLICY IF EXISTS "Auth update payments" ON public.payments;
DROP POLICY IF EXISTS "Owners delete payments" ON public.payments;
CREATE POLICY "Staff read payments" ON public.payments FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff update payments" ON public.payments FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Owners delete payments" ON public.payments FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'owner'));

-- company_settings
DROP POLICY IF EXISTS "Owners insert settings" ON public.company_settings;
DROP POLICY IF EXISTS "Owners update settings" ON public.company_settings;
CREATE POLICY "Owners insert settings" ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners update settings" ON public.company_settings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'owner')) WITH CHECK (private.has_role(auth.uid(), 'owner'));

-- Storage: drop any leftover bill-documents policies (may not match earlier drop names)
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%bill-documents%' OR with_check LIKE '%bill-documents%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Drop old public helper now that no policies depend on it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

-- Recreate storage policies with private helpers
CREATE POLICY "Staff read bill-documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bill-documents' AND private.is_staff(auth.uid()));
CREATE POLICY "Staff upload bill-documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bill-documents' AND private.is_staff(auth.uid()));
CREATE POLICY "Staff update bill-documents" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bill-documents' AND private.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'bill-documents' AND private.is_staff(auth.uid()));
CREATE POLICY "Owners delete bill-documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bill-documents' AND private.has_role(auth.uid(), 'owner'));
