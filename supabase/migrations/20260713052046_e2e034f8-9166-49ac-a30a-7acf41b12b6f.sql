
CREATE POLICY "Auth read bill-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bill-documents');

CREATE POLICY "Auth upload bill-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bill-documents');

CREATE POLICY "Auth update bill-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bill-documents')
  WITH CHECK (bucket_id = 'bill-documents');

CREATE POLICY "Owners delete bill-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bill-documents' AND public.has_role(auth.uid(), 'owner'));
