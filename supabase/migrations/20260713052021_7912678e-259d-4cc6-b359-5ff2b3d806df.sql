
-- =========================================
-- ENUMS & CORE AUTH-LINKED TABLES
-- =========================================
CREATE TYPE public.app_role AS ENUM ('owner', 'accountant');

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- User roles (separate table to avoid privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users read own roles or owners read all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Auto create profile + assign role on signup (first user = owner)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  role_to_assign app_role;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') THEN
    role_to_assign := 'owner';
  ELSE
    role_to_assign := 'accountant';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, role_to_assign);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- SUPPLIERS
-- =========================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  alt_phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  gst_number TEXT NOT NULL DEFAULT '',
  pan_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  pincode TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'India',
  payment_terms TEXT NOT NULL DEFAULT '',
  credit_days INT NOT NULL DEFAULT 30,
  preferred_payment_method TEXT NOT NULL DEFAULT '',
  opening_outstanding NUMERIC NOT NULL DEFAULT 0,
  opening_balance_date DATE,
  bank_name TEXT NOT NULL DEFAULT '',
  account_holder_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  ifsc TEXT NOT NULL DEFAULT '',
  upi_id TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'wholesaler',
  status TEXT NOT NULL DEFAULT 'active',
  archived BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owners delete suppliers" ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_suppliers_archived ON public.suppliers(archived);
CREATE INDEX idx_suppliers_name ON public.suppliers(supplier_name);

-- =========================================
-- BILLS
-- =========================================
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  gst NUMERIC NOT NULL DEFAULT 0,
  other_charges NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  gst_type TEXT NOT NULL DEFAULT 'cgst_sgst',
  gst_rate NUMERIC NOT NULL DEFAULT 5,
  igst_amount NUMERIC,
  cgst_amount NUMERIC,
  sgst_amount NUMERIC,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bills" ON public.bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bills" ON public.bills FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bills" ON public.bills FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owners delete bills" ON public.bills FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_bills_supplier ON public.bills(supplier_id);
CREATE INDEX idx_bills_status ON public.bills(status);
CREATE INDEX idx_bills_due ON public.bills(due_date);

-- =========================================
-- BILL DOCUMENTS
-- =========================================
CREATE TABLE public.bill_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_documents TO authenticated;
GRANT ALL ON public.bill_documents TO service_role;
ALTER TABLE public.bill_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bill_documents" ON public.bill_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bill_documents" ON public.bill_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bill_documents" ON public.bill_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owners delete bill_documents" ON public.bill_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE INDEX idx_bill_documents_bill ON public.bill_documents(bill_id);

-- =========================================
-- PAYMENTS
-- =========================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  mode TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update payments" ON public.payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owners delete payments" ON public.payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE INDEX idx_payments_supplier ON public.payments(supplier_id);
CREATE INDEX idx_payments_bill ON public.payments(bill_id);

-- =========================================
-- ACTIVITIES (dashboard feed)
-- =========================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read activities" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_activities_at ON public.activities(at DESC);

-- =========================================
-- SUPPLIER HISTORY (audit trail)
-- =========================================
CREATE TABLE public.supplier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_name TEXT NOT NULL DEFAULT 'System',
  action TEXT NOT NULL,
  details TEXT
);
GRANT SELECT, INSERT ON public.supplier_history TO authenticated;
GRANT ALL ON public.supplier_history TO service_role;
ALTER TABLE public.supplier_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read supplier_history" ON public.supplier_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert supplier_history" ON public.supplier_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_supplier_history_supplier ON public.supplier_history(supplier_id, at DESC);

-- =========================================
-- COMPANY SETTINGS (singleton row)
-- =========================================
CREATE TABLE public.company_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  company_name TEXT NOT NULL DEFAULT 'ARK Distributors',
  company_state TEXT NOT NULL DEFAULT 'Andhra Pradesh',
  logo_data_url TEXT,
  notify_today BOOLEAN NOT NULL DEFAULT true,
  notify_tomorrow BOOLEAN NOT NULL DEFAULT true,
  notify_overdue BOOLEAN NOT NULL DEFAULT true,
  theme TEXT NOT NULL DEFAULT 'light',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 'global')
);
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert settings" ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners update settings" ON public.company_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the singleton settings row (safe to run without any auth user)
INSERT INTO public.company_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- =========================================
-- SEED SUPPLIERS (55 pre-loaded suppliers)
-- =========================================
INSERT INTO public.suppliers (code, supplier_name, company_name, opening_outstanding) VALUES
  ('SUP001','Alfa Synthatics','Alfa Synthatics',0),
  ('SUP002','Alive Fations','Alive Fations',0),
  ('SUP003','Arihant Synthatics','Arihant Synthatics',0),
  ('SUP004','Basic Hoseiry','Basic Hoseiry',0),
  ('SUP005','Basic Hosiery','Basic Hosiery',0),
  ('SUP006','Beecha Apparels','Beecha Apparels',76000),
  ('SUP007','Bhagyalakshmi Enterprises','Bhagyalakshmi Enterprises',0),
  ('SUP008','BONNY''S THE BOUTIQUE','BONNY''S THE BOUTIQUE',0),
  ('SUP009','Bonnys Nx','Bonnys Nx',0),
  ('SUP010','CREDIT NOTE1','CREDIT NOTE1',0),
  ('SUP011','Deepak Dupatta Centre','Deepak Dupatta Centre',0),
  ('SUP012','Enagic India Kangen Water Pvt. Ltd.','Enagic India Kangen Water Pvt. Ltd.',0),
  ('SUP013','Exena Garments','Exena Garments',0),
  ('SUP014','Fly Birds Garments','Fly Birds Garments',425000),
  ('SUP015','Gh Agency Nagpur','Gh Agency Nagpur',0),
  ('SUP016','Gh Enter Prises Inc','Gh Enter Prises Inc',0),
  ('SUP017','GH TEXTILES AHMEDABAD','GH TEXTILES AHMEDABAD',312500),
  ('SUP018','G H TEXTILES SURAT','G H TEXTILES SURAT',0),
  ('SUP019','Janvi N.x','Janvi N.x',0),
  ('SUP020','Jinal Fashion','Jinal Fashion',0),
  ('SUP021','Jisaan Fashion World','Jisaan Fashion World',0),
  ('SUP022','JYOTIRMAI COTTON COMPANY','JYOTIRMAI COTTON COMPANY',0),
  ('SUP023','K AKANSHKUMAR','K AKANSHKUMAR',0),
  ('SUP024','Kanika Tex O Fab','Kanika Tex O Fab',0),
  ('SUP025','Kiran Power Systam','Kiran Power Systam',0),
  ('SUP026','K.SATISH & CO','K.SATISH & CO',0),
  ('SUP027','LAALA JEANSWALA','LAALA JEANSWALA',0),
  ('SUP028','LAXMI HOSIERY PRODUCTS','LAXMI HOSIERY PRODUCTS',0),
  ('SUP029','Mahak Dupatta','Mahak Dupatta',0),
  ('SUP030','Manan Apparels','Manan Apparels',0),
  ('SUP031','Mcm Life Style','Mcm Life Style',0),
  ('SUP032','Mega Lap Store','Mega Lap Store',0),
  ('SUP033','Midas Fashions','Midas Fashions',0),
  ('SUP034','MUNNISH INNERWEAR PVT LTD','MUNNISH INNERWEAR PVT LTD',0),
  ('SUP035','N.S.K. Garments','N.S.K. Garments',0),
  ('SUP036','ODHANI CREATION','ODHANI CREATION',0),
  ('SUP037','PRAKASH GARMENTS','PRAKASH GARMENTS',1928221.56),
  ('SUP038','Princes Creation','Princes Creation',189400),
  ('SUP039','Ravi Synthtics','Ravi Synthtics',0),
  ('SUP040','S Dilip Kumar','S Dilip Kumar',0),
  ('SUP041','Shah Dipak Jayantilal HUF','Shah Dipak Jayantilal HUF',0),
  ('SUP042','Shivali Boutique PVT. LTD','Shivali Boutique PVT. LTD',0),
  ('SUP043','Shivay Fashions','Shivay Fashions',0),
  ('SUP044','Shri Shakthi Systems','Shri Shakthi Systems',0),
  ('SUP045','SHYAM IMPEX','SHYAM IMPEX',0),
  ('SUP046','Silver Leaf Clothing Co','Silver Leaf Clothing Co',0),
  ('SUP047','Smith Asish Kumar Shah','Smith Asish Kumar Shah',0),
  ('SUP048','Soft Touch','Soft Touch',0),
  ('SUP049','SPS TEX','SPS TEX',0),
  ('SUP050','Sri Balaji Electronics','Sri Balaji Electronics',0),
  ('SUP051','Sri Dinesh Textiles','Sri Dinesh Textiles',0),
  ('SUP052','Stree Life Style','Stree Life Style',0),
  ('SUP053','Surya Enterprises','Surya Enterprises',0),
  ('SUP054','VEETRAG FASHION','VEETRAG FASHION',0),
  ('SUP055','ZIRR','ZIRR',0)
ON CONFLICT (code) DO NOTHING;

-- =========================================
-- SEED SAMPLE BILLS
-- =========================================
INSERT INTO public.bills (invoice_number, supplier_id, invoice_date, due_date, subtotal, gst, other_charges, total, gst_type, gst_rate, cgst_amount, sgst_amount, status)
SELECT 'PG/24-25/1042', s.id, CURRENT_DATE - 12, CURRENT_DATE + 18, 185000, 9250, 0, 194250, 'cgst_sgst', 5, 4625, 4625, 'pending'
FROM public.suppliers s WHERE s.code = 'SUP037'
ON CONFLICT DO NOTHING;

INSERT INTO public.bills (invoice_number, supplier_id, invoice_date, due_date, subtotal, gst, other_charges, total, gst_type, gst_rate, cgst_amount, sgst_amount, status)
SELECT 'FBG/25/0088', s.id, CURRENT_DATE - 5, CURRENT_DATE + 10, 92000, 4600, 0, 96600, 'cgst_sgst', 5, 2300, 2300, 'pending'
FROM public.suppliers s WHERE s.code = 'SUP014'
ON CONFLICT DO NOTHING;

-- =========================================
-- SEED ACTIVITY
-- =========================================
INSERT INTO public.activities (type, message) VALUES
  ('supplier_added', 'Supplier Master initialised with 55 suppliers');
