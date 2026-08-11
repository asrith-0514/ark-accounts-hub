-- Enable realtime for collaborative multi-user experience
ALTER TABLE public.suppliers REPLICA IDENTITY FULL;
ALTER TABLE public.bills REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.bill_documents REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.supplier_history REPLICA IDENTITY FULL;
ALTER TABLE public.company_settings REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_settings;

-- Extend activities so the Activity Log page can show user + entity
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS user_name text NOT NULL DEFAULT 'System',
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text;

CREATE INDEX IF NOT EXISTS idx_activities_at ON public.activities (at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_history_at ON public.supplier_history (at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_supplier ON public.bills (supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON public.payments (bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_supplier ON public.payments (supplier_id);