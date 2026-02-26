-- Allow users to view their own uploaded documents
CREATE POLICY "Users can view their own documents"
ON public.client_documents
FOR SELECT
USING (auth.uid() = client_id);