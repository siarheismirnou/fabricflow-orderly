CREATE TYPE public.doc_kind AS ENUM ('supplier_invoice','payment_order');
CREATE TABLE public.order_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind public.doc_kind NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.order_documents TO authenticated;
GRANT ALL ON public.order_documents TO service_role;
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read docs" ON public.order_documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "upload docs" ON public.order_documents FOR INSERT TO authenticated WITH CHECK (
  (kind = 'supplier_invoice' AND public.has_any_role(auth.uid(), ARRAY['super_admin','sales_manager','warehouse']::app_role[]))
  OR (kind = 'payment_order' AND public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[])));
CREATE POLICY "delete own docs" ON public.order_documents FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "staff read order files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'order-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "staff upload order files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-documents' AND public.has_any_role(auth.uid(), ARRAY['super_admin','sales_manager','warehouse','accountant']::app_role[]));
CREATE POLICY "owner delete order files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'order-documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'super_admin')));