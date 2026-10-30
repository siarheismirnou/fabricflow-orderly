ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS margin_percent numeric;

REVOKE SELECT, INSERT, UPDATE ON public.stock_receipts FROM authenticated, anon;
GRANT SELECT (id, product_id, supplier_id, meters, remaining_meters, received_at, received_by, note) ON public.stock_receipts TO authenticated;
GRANT INSERT (product_id, supplier_id, meters, remaining_meters, received_at, received_by, note) ON public.stock_receipts TO authenticated;
GRANT UPDATE (product_id, supplier_id, meters, remaining_meters, received_at, note) ON public.stock_receipts TO authenticated;

REVOKE SELECT, INSERT, UPDATE ON public.products FROM authenticated, anon;
GRANT SELECT (id, sku, name, composition, color, width_cm, sale_price, created_at) ON public.products TO authenticated;
GRANT INSERT (sku, name, composition, color, width_cm) ON public.products TO authenticated;
GRANT UPDATE (sku, name, composition, color, width_cm) ON public.products TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_receipt_costs()
RETURNS TABLE(id uuid, product_id uuid, remaining_meters numeric, purchase_price numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT r.id, r.product_id, r.remaining_meters, r.purchase_price FROM public.stock_receipts r;
END $$;

CREATE OR REPLACE FUNCTION public.admin_product_costs()
RETURNS TABLE(id uuid, cost_price numeric, margin_percent numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.cost_price, p.margin_percent FROM public.products p;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_receipt_cost(_id uuid, _price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Себестоимость может задавать только супер-админ'; END IF;
  UPDATE public.stock_receipts SET purchase_price = _price WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_product_pricing(_id uuid, _cost numeric, _margin numeric, _sale numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Цены может задавать только супер-админ'; END IF;
  UPDATE public.products SET cost_price = _cost, margin_percent = _margin, sale_price = _sale WHERE id = _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_receipt_costs(), public.admin_product_costs(), public.admin_set_receipt_cost(uuid, numeric), public.admin_set_product_pricing(uuid, numeric, numeric, numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_receipt_costs(), public.admin_product_costs(), public.admin_set_receipt_cost(uuid, numeric), public.admin_set_product_pricing(uuid, numeric, numeric, numeric) TO authenticated;