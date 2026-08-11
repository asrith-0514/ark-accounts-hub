CREATE OR REPLACE VIEW public.suppliers_with_balances AS
WITH bill_payments AS (
  SELECT bill_id, COALESCE(SUM(amount), 0) AS paid_amount
  FROM public.payments
  GROUP BY bill_id
),
bill_outstanding AS (
  SELECT b.supplier_id,
         COALESCE(SUM(b.grand_total - COALESCE(bp.paid_amount, 0)), 0) AS bills_outstanding
  FROM public.bills b
  LEFT JOIN bill_payments bp ON bp.bill_id = b.id
  WHERE b.deleted_at IS NULL
  GROUP BY b.supplier_id
)
SELECT s.*,
       COALESCE(s.opening_outstanding + COALESCE(bo.bills_outstanding, 0), 0) AS total_outstanding
FROM public.suppliers s
LEFT JOIN bill_outstanding bo ON bo.supplier_id = s.id;

GRANT SELECT ON public.suppliers_with_balances TO authenticated;
