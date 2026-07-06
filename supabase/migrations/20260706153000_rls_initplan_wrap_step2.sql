-- rls_initplan_wrap step 2: wrap the INNER bare auth.uid() inside already-wrapped helper calls
-- (the advisor lints textually; official pattern is (select has_role((select auth.uid()), ...)) )

-- aftersales_records: Admins can delete aftersales records (DELETE)
DROP POLICY IF EXISTS "Admins can delete aftersales records" ON public.aftersales_records;
CREATE POLICY "Admins can delete aftersales records" ON public.aftersales_records
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- aftersales_records: Admins can insert aftersales records (INSERT)
DROP POLICY IF EXISTS "Admins can insert aftersales records" ON public.aftersales_records;
CREATE POLICY "Admins can insert aftersales records" ON public.aftersales_records
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- aftersales_records: Admins can update aftersales records (UPDATE)
DROP POLICY IF EXISTS "Admins can update aftersales records" ON public.aftersales_records;
CREATE POLICY "Admins can update aftersales records" ON public.aftersales_records
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- aftersales_records: Admins can view all aftersales records (SELECT)
DROP POLICY IF EXISTS "Admins can view all aftersales records" ON public.aftersales_records;
CREATE POLICY "Admins can view all aftersales records" ON public.aftersales_records
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- analytics_events: Admins can view all analytics (SELECT)
DROP POLICY IF EXISTS "Admins can view all analytics" ON public.analytics_events;
CREATE POLICY "Admins can view all analytics" ON public.analytics_events
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- application_drafts: Admins can delete drafts (DELETE)
DROP POLICY IF EXISTS "Admins can delete drafts" ON public.application_drafts;
CREATE POLICY "Admins can delete drafts" ON public.application_drafts
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- application_drafts: Admins can view drafts (SELECT)
DROP POLICY IF EXISTS "Admins can view drafts" ON public.application_drafts;
CREATE POLICY "Admins can view drafts" ON public.application_drafts
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- application_drafts: Sales agents can view drafts (SELECT)
DROP POLICY IF EXISTS "Sales agents can view drafts" ON public.application_drafts;
CREATE POLICY "Sales agents can view drafts" ON public.application_drafts
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- application_matches: Admins can delete matches (DELETE)
DROP POLICY IF EXISTS "Admins can delete matches" ON public.application_matches;
CREATE POLICY "Admins can delete matches" ON public.application_matches
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- application_matches: Admins can insert matches (INSERT)
DROP POLICY IF EXISTS "Admins can insert matches" ON public.application_matches;
CREATE POLICY "Admins can insert matches" ON public.application_matches
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- application_matches: Admins can update matches (UPDATE)
DROP POLICY IF EXISTS "Admins can update matches" ON public.application_matches;
CREATE POLICY "Admins can update matches" ON public.application_matches
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- application_matches: Admins can view all matches (SELECT)
DROP POLICY IF EXISTS "Admins can view all matches" ON public.application_matches;
CREATE POLICY "Admins can view all matches" ON public.application_matches
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- application_matches: Sales agents can view application matches (SELECT)
DROP POLICY IF EXISTS "Sales agents can view application matches" ON public.application_matches;
CREATE POLICY "Sales agents can view application matches" ON public.application_matches
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- client_audit_logs: Admins can manage audit logs (ALL)
DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.client_audit_logs;
CREATE POLICY "Admins can manage audit logs" ON public.client_audit_logs
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- client_audit_logs: F&I can manage audit logs (ALL)
DROP POLICY IF EXISTS "F&I can manage audit logs" ON public.client_audit_logs;
CREATE POLICY "F&I can manage audit logs" ON public.client_audit_logs
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role));

-- client_audit_logs: Sales agents can manage audit logs (ALL)
DROP POLICY IF EXISTS "Sales agents can manage audit logs" ON public.client_audit_logs;
CREATE POLICY "Sales agents can manage audit logs" ON public.client_audit_logs
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- client_comments: Admins can delete client comments (DELETE)
DROP POLICY IF EXISTS "Admins can delete client comments" ON public.client_comments;
CREATE POLICY "Admins can delete client comments" ON public.client_comments
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- client_comments: Admins can insert client comments (INSERT)
DROP POLICY IF EXISTS "Admins can insert client comments" ON public.client_comments;
CREATE POLICY "Admins can insert client comments" ON public.client_comments
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- client_comments: Admins can view client comments (SELECT)
DROP POLICY IF EXISTS "Admins can view client comments" ON public.client_comments;
CREATE POLICY "Admins can view client comments" ON public.client_comments
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- client_documents: Admins can delete client documents (DELETE)
DROP POLICY IF EXISTS "Admins can delete client documents" ON public.client_documents;
CREATE POLICY "Admins can delete client documents" ON public.client_documents
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- client_documents: Admins can insert client documents (INSERT)
DROP POLICY IF EXISTS "Admins can insert client documents" ON public.client_documents;
CREATE POLICY "Admins can insert client documents" ON public.client_documents
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- client_documents: Admins can view client documents (SELECT)
DROP POLICY IF EXISTS "Admins can view client documents" ON public.client_documents;
CREATE POLICY "Admins can view client documents" ON public.client_documents
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_desk_settings: dd_settings write (ALL)
DROP POLICY IF EXISTS "dd_settings write" ON public.deal_desk_settings;
CREATE POLICY "dd_settings write" ON public.deal_desk_settings
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_expenses: Admins can delete deal expenses (DELETE)
DROP POLICY IF EXISTS "Admins can delete deal expenses" ON public.deal_expenses;
CREATE POLICY "Admins can delete deal expenses" ON public.deal_expenses
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_expenses: Admins can insert deal expenses (INSERT)
DROP POLICY IF EXISTS "Admins can insert deal expenses" ON public.deal_expenses;
CREATE POLICY "Admins can insert deal expenses" ON public.deal_expenses
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_expenses: Admins can update deal expenses (UPDATE)
DROP POLICY IF EXISTS "Admins can update deal expenses" ON public.deal_expenses;
CREATE POLICY "Admins can update deal expenses" ON public.deal_expenses
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_expenses: Admins can view all deal expenses (SELECT)
DROP POLICY IF EXISTS "Admins can view all deal expenses" ON public.deal_expenses;
CREATE POLICY "Admins can view all deal expenses" ON public.deal_expenses
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_records: Accountants can view deal records (SELECT)
DROP POLICY IF EXISTS "Accountants can view deal records" ON public.deal_records;
CREATE POLICY "Accountants can view deal records" ON public.deal_records
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role));

-- deal_records: Admins can delete deal records (DELETE)
DROP POLICY IF EXISTS "Admins can delete deal records" ON public.deal_records;
CREATE POLICY "Admins can delete deal records" ON public.deal_records
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_records: Admins can insert deal records (INSERT)
DROP POLICY IF EXISTS "Admins can insert deal records" ON public.deal_records;
CREATE POLICY "Admins can insert deal records" ON public.deal_records
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_records: Admins can update deal records (UPDATE)
DROP POLICY IF EXISTS "Admins can update deal records" ON public.deal_records;
CREATE POLICY "Admins can update deal records" ON public.deal_records
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_records: Admins can view all deal records (SELECT)
DROP POLICY IF EXISTS "Admins can view all deal records" ON public.deal_records;
CREATE POLICY "Admins can view all deal records" ON public.deal_records
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- deal_records: Senior F&I insert deal records (INSERT)
DROP POLICY IF EXISTS "Senior F&I insert deal records" ON public.deal_records;
CREATE POLICY "Senior F&I insert deal records" ON public.deal_records
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role));

-- deal_records: Senior F&I update deal records (UPDATE)
DROP POLICY IF EXISTS "Senior F&I update deal records" ON public.deal_records;
CREATE POLICY "Senior F&I update deal records" ON public.deal_records
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role));

-- deal_records: Senior F&I view deal records (SELECT)
DROP POLICY IF EXISTS "Senior F&I view deal records" ON public.deal_records;
CREATE POLICY "Senior F&I view deal records" ON public.deal_records
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role));

-- delivery_tasks: Admins can manage delivery tasks (ALL)
DROP POLICY IF EXISTS "Admins can manage delivery tasks" ON public.delivery_tasks;
CREATE POLICY "Admins can manage delivery tasks" ON public.delivery_tasks
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- documents: Admins can delete documents (DELETE)
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
CREATE POLICY "Admins can delete documents" ON public.documents
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- documents: Admins can insert documents (INSERT)
DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
CREATE POLICY "Admins can insert documents" ON public.documents
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- documents: Admins can update documents (UPDATE)
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
CREATE POLICY "Admins can update documents" ON public.documents
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- documents: Admins can view documents (SELECT)
DROP POLICY IF EXISTS "Admins can view documents" ON public.documents;
CREATE POLICY "Admins can view documents" ON public.documents
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- email_templates: Admins can insert email templates (INSERT)
DROP POLICY IF EXISTS "Admins can insert email templates" ON public.email_templates;
CREATE POLICY "Admins can insert email templates" ON public.email_templates
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- email_templates: Admins can update email templates (UPDATE)
DROP POLICY IF EXISTS "Admins can update email templates" ON public.email_templates;
CREATE POLICY "Admins can update email templates" ON public.email_templates
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- email_templates: Admins can view email templates (SELECT)
DROP POLICY IF EXISTS "Admins can view email templates" ON public.email_templates;
CREATE POLICY "Admins can view email templates" ON public.email_templates
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- export_presets: Admins manage export presets (ALL)
DROP POLICY IF EXISTS "Admins manage export presets" ON public.export_presets;
CREATE POLICY "Admins manage export presets" ON public.export_presets
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- export_presets: Staff can read export presets (SELECT)
DROP POLICY IF EXISTS "Staff can read export presets" ON public.export_presets;
CREATE POLICY "Staff can read export presets" ON public.export_presets
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT is_staff((select auth.uid())) AS is_staff));

-- extra_service_incomes: Admins can manage extra services (ALL)
DROP POLICY IF EXISTS "Admins can manage extra services" ON public.extra_service_incomes;
CREATE POLICY "Admins can manage extra services" ON public.extra_service_incomes
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_applications: Accountants can update finance applications (UPDATE)
DROP POLICY IF EXISTS "Accountants can update finance applications" ON public.finance_applications;
CREATE POLICY "Accountants can update finance applications" ON public.finance_applications
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role));

-- finance_applications: Accountants can view finance applications (SELECT)
DROP POLICY IF EXISTS "Accountants can view finance applications" ON public.finance_applications;
CREATE POLICY "Accountants can view finance applications" ON public.finance_applications
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role));

-- finance_applications: Admins can delete applications (DELETE)
DROP POLICY IF EXISTS "Admins can delete applications" ON public.finance_applications;
CREATE POLICY "Admins can delete applications" ON public.finance_applications
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_applications: Admins can update applications (UPDATE)
DROP POLICY IF EXISTS "Admins can update applications" ON public.finance_applications;
CREATE POLICY "Admins can update applications" ON public.finance_applications
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_applications: Admins can view all applications (SELECT)
DROP POLICY IF EXISTS "Admins can view all applications" ON public.finance_applications;
CREATE POLICY "Admins can view all applications" ON public.finance_applications
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_applications: F&I can update finance applications (UPDATE)
DROP POLICY IF EXISTS "F&I can update finance applications" ON public.finance_applications;
CREATE POLICY "F&I can update finance applications" ON public.finance_applications
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) AND (( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role) OR (assigned_f_and_i = ( SELECT auth.uid() AS uid)))))
  WITH CHECK ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) AND (( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role) OR (assigned_f_and_i = ( SELECT auth.uid() AS uid)))));

-- finance_applications: F&I can view finance applications (SELECT)
DROP POLICY IF EXISTS "F&I can view finance applications" ON public.finance_applications;
CREATE POLICY "F&I can view finance applications" ON public.finance_applications
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) AND (( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role) OR (assigned_f_and_i = ( SELECT auth.uid() AS uid)))));

-- finance_applications: Sales agents can update finance applications (UPDATE)
DROP POLICY IF EXISTS "Sales agents can update finance applications" ON public.finance_applications;
CREATE POLICY "Sales agents can update finance applications" ON public.finance_applications
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- finance_applications: Sales agents can view all finance applications (SELECT)
DROP POLICY IF EXISTS "Sales agents can view all finance applications" ON public.finance_applications;
CREATE POLICY "Sales agents can view all finance applications" ON public.finance_applications
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- finance_applications: Staff can insert applications on behalf of clients (INSERT)
DROP POLICY IF EXISTS "Staff can insert applications on behalf of clients" ON public.finance_applications;
CREATE POLICY "Staff can insert applications on behalf of clients" ON public.finance_applications
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- finance_banks: Admins can manage banks (ALL)
DROP POLICY IF EXISTS "Admins can manage banks" ON public.finance_banks;
CREATE POLICY "Admins can manage banks" ON public.finance_banks
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_banks: F&I view finance banks (SELECT)
DROP POLICY IF EXISTS "F&I view finance banks" ON public.finance_banks;
CREATE POLICY "F&I view finance banks" ON public.finance_banks
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- finance_banks: Staff can read banks (SELECT)
DROP POLICY IF EXISTS "Staff can read banks" ON public.finance_banks;
CREATE POLICY "Staff can read banks" ON public.finance_banks
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT is_staff((select auth.uid())) AS is_staff));

-- finance_offers: Admins can delete offers (DELETE)
DROP POLICY IF EXISTS "Admins can delete offers" ON public.finance_offers;
CREATE POLICY "Admins can delete offers" ON public.finance_offers
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_offers: Admins can insert offers (INSERT)
DROP POLICY IF EXISTS "Admins can insert offers" ON public.finance_offers;
CREATE POLICY "Admins can insert offers" ON public.finance_offers
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_offers: Admins can update offers (UPDATE)
DROP POLICY IF EXISTS "Admins can update offers" ON public.finance_offers;
CREATE POLICY "Admins can update offers" ON public.finance_offers
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_offers: Admins can view all offers (SELECT)
DROP POLICY IF EXISTS "Admins can view all offers" ON public.finance_offers;
CREATE POLICY "Admins can view all offers" ON public.finance_offers
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- finance_offers: F&I delete finance offers (DELETE)
DROP POLICY IF EXISTS "F&I delete finance offers" ON public.finance_offers;
CREATE POLICY "F&I delete finance offers" ON public.finance_offers
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- finance_offers: F&I insert finance offers (INSERT)
DROP POLICY IF EXISTS "F&I insert finance offers" ON public.finance_offers;
CREATE POLICY "F&I insert finance offers" ON public.finance_offers
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- finance_offers: F&I update finance offers (UPDATE)
DROP POLICY IF EXISTS "F&I update finance offers" ON public.finance_offers;
CREATE POLICY "F&I update finance offers" ON public.finance_offers
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- finance_offers: F&I view finance offers (SELECT)
DROP POLICY IF EXISTS "F&I view finance offers" ON public.finance_offers;
CREATE POLICY "F&I view finance offers" ON public.finance_offers
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- finance_offers: Sales agents can view finance offers (SELECT)
DROP POLICY IF EXISTS "Sales agents can view finance offers" ON public.finance_offers;
CREATE POLICY "Sales agents can view finance offers" ON public.finance_offers
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- integration_settings: integ_select (SELECT)
DROP POLICY IF EXISTS "integ_select" ON public.integration_settings;
CREATE POLICY "integ_select" ON public.integration_settings
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((( SELECT is_staff((select auth.uid())) AS is_staff) OR ((key = 'signio'::text) AND (( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role)))));

-- integration_settings: integ_write (ALL)
DROP POLICY IF EXISTS "integ_write" ON public.integration_settings;
CREATE POLICY "integ_write" ON public.integration_settings
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- inventory_tasks: Admins can delete inventory tasks (DELETE)
DROP POLICY IF EXISTS "Admins can delete inventory tasks" ON public.inventory_tasks;
CREATE POLICY "Admins can delete inventory tasks" ON public.inventory_tasks
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- inventory_tasks: Admins can insert inventory tasks (INSERT)
DROP POLICY IF EXISTS "Admins can insert inventory tasks" ON public.inventory_tasks;
CREATE POLICY "Admins can insert inventory tasks" ON public.inventory_tasks
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- inventory_tasks: Admins can update inventory tasks (UPDATE)
DROP POLICY IF EXISTS "Admins can update inventory tasks" ON public.inventory_tasks;
CREATE POLICY "Admins can update inventory tasks" ON public.inventory_tasks
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- inventory_tasks: Admins can view inventory tasks (SELECT)
DROP POLICY IF EXISTS "Admins can view inventory tasks" ON public.inventory_tasks;
CREATE POLICY "Admins can view inventory tasks" ON public.inventory_tasks
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- juristic_submissions: Admins manage juristic submissions (ALL)
DROP POLICY IF EXISTS "Admins manage juristic submissions" ON public.juristic_submissions;
CREATE POLICY "Admins manage juristic submissions" ON public.juristic_submissions
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- juristic_submissions: Sales agents view juristic submissions (SELECT)
DROP POLICY IF EXISTS "Sales agents view juristic submissions" ON public.juristic_submissions;
CREATE POLICY "Sales agents view juristic submissions" ON public.juristic_submissions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role)));

-- lead_notes: Admins can delete lead notes (DELETE)
DROP POLICY IF EXISTS "Admins can delete lead notes" ON public.lead_notes;
CREATE POLICY "Admins can delete lead notes" ON public.lead_notes
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- lead_notes: Admins can insert lead notes (INSERT)
DROP POLICY IF EXISTS "Admins can insert lead notes" ON public.lead_notes;
CREATE POLICY "Admins can insert lead notes" ON public.lead_notes
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- lead_notes: Admins can view lead notes (SELECT)
DROP POLICY IF EXISTS "Admins can view lead notes" ON public.lead_notes;
CREATE POLICY "Admins can view lead notes" ON public.lead_notes
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- lead_notes: Sales agents can insert lead notes (INSERT)
DROP POLICY IF EXISTS "Sales agents can insert lead notes" ON public.lead_notes;
CREATE POLICY "Sales agents can insert lead notes" ON public.lead_notes
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- lead_notes: Sales agents can view lead notes (SELECT)
DROP POLICY IF EXISTS "Sales agents can view lead notes" ON public.lead_notes;
CREATE POLICY "Sales agents can view lead notes" ON public.lead_notes
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- leads: Admins can delete leads (DELETE)
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
CREATE POLICY "Admins can delete leads" ON public.leads
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- leads: Admins can update leads (UPDATE)
DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
CREATE POLICY "Admins can update leads" ON public.leads
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- leads: Admins can view all leads (SELECT)
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
CREATE POLICY "Admins can view all leads" ON public.leads
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- leads: Sales agents can update leads (UPDATE)
DROP POLICY IF EXISTS "Sales agents can update leads" ON public.leads;
CREATE POLICY "Sales agents can update leads" ON public.leads
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- leads: Sales agents can view all leads (SELECT)
DROP POLICY IF EXISTS "Sales agents can view all leads" ON public.leads;
CREATE POLICY "Sales agents can view all leads" ON public.leads
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- otps: Admins can delete OTPs (DELETE)
DROP POLICY IF EXISTS "Admins can delete OTPs" ON public.otps;
CREATE POLICY "Admins can delete OTPs" ON public.otps
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- pipeline_lane_overrides: plo_select (SELECT)
DROP POLICY IF EXISTS "plo_select" ON public.pipeline_lane_overrides;
CREATE POLICY "plo_select" ON public.pipeline_lane_overrides
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT is_staff((select auth.uid())) AS is_staff));

-- pipeline_lane_overrides: plo_write (ALL)
DROP POLICY IF EXISTS "plo_write" ON public.pipeline_lane_overrides;
CREATE POLICY "plo_write" ON public.pipeline_lane_overrides
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- profiles: Admins can update all profiles (UPDATE)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- profiles: Admins can view all profiles (SELECT)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- profiles: F&I staff can view staff profiles (SELECT)
DROP POLICY IF EXISTS "F&I staff can view staff profiles" ON public.profiles;
CREATE POLICY "F&I staff can view staff profiles" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role)));

-- profiles: Sales agents can view profiles (SELECT)
DROP POLICY IF EXISTS "Sales agents can view profiles" ON public.profiles;
CREATE POLICY "Sales agents can view profiles" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- referrals: Admins can delete referrals (DELETE)
DROP POLICY IF EXISTS "Admins can delete referrals" ON public.referrals;
CREATE POLICY "Admins can delete referrals" ON public.referrals
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- referrals: Admins can insert referrals (INSERT)
DROP POLICY IF EXISTS "Admins can insert referrals" ON public.referrals;
CREATE POLICY "Admins can insert referrals" ON public.referrals
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- referrals: Admins can update referrals (UPDATE)
DROP POLICY IF EXISTS "Admins can update referrals" ON public.referrals;
CREATE POLICY "Admins can update referrals" ON public.referrals
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- referrals: Admins can view referrals (SELECT)
DROP POLICY IF EXISTS "Admins can view referrals" ON public.referrals;
CREATE POLICY "Admins can view referrals" ON public.referrals
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- rental_logs: Admins can manage rental logs (ALL)
DROP POLICY IF EXISTS "Admins can manage rental logs" ON public.rental_logs;
CREATE POLICY "Admins can manage rental logs" ON public.rental_logs
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- rentals: Admins can manage rentals (ALL)
DROP POLICY IF EXISTS "Admins can manage rentals" ON public.rentals;
CREATE POLICY "Admins can manage rentals" ON public.rentals
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- role_section_access: Admins manage role section access (ALL)
DROP POLICY IF EXISTS "Admins manage role section access" ON public.role_section_access;
CREATE POLICY "Admins manage role section access" ON public.role_section_access
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- role_section_access: Staff can read role section access (SELECT)
DROP POLICY IF EXISTS "Staff can read role section access" ON public.role_section_access;
CREATE POLICY "Staff can read role section access" ON public.role_section_access
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT is_staff((select auth.uid())) AS is_staff));

-- sell_car_requests: Admins can delete sell requests (DELETE)
DROP POLICY IF EXISTS "Admins can delete sell requests" ON public.sell_car_requests;
CREATE POLICY "Admins can delete sell requests" ON public.sell_car_requests
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- sell_car_requests: Admins can update sell requests (UPDATE)
DROP POLICY IF EXISTS "Admins can update sell requests" ON public.sell_car_requests;
CREATE POLICY "Admins can update sell requests" ON public.sell_car_requests
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- sell_car_requests: Admins can view sell requests (SELECT)
DROP POLICY IF EXISTS "Admins can view sell requests" ON public.sell_car_requests;
CREATE POLICY "Admins can view sell requests" ON public.sell_car_requests
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- site_settings: Admins can insert site settings (INSERT)
DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
CREATE POLICY "Admins can insert site settings" ON public.site_settings
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- site_settings: Admins can update site settings (UPDATE)
DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
CREATE POLICY "Admins can update site settings" ON public.site_settings
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- site_settings: Admins can view site settings (SELECT)
DROP POLICY IF EXISTS "Admins can view site settings" ON public.site_settings;
CREATE POLICY "Admins can view site settings" ON public.site_settings
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- site_settings: Sales agents can view site settings (SELECT)
DROP POLICY IF EXISTS "Sales agents can view site settings" ON public.site_settings;
CREATE POLICY "Sales agents can view site settings" ON public.site_settings
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- status_overrides: so_select (SELECT)
DROP POLICY IF EXISTS "so_select" ON public.status_overrides;
CREATE POLICY "so_select" ON public.status_overrides
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT is_staff((select auth.uid())) AS is_staff));

-- status_overrides: so_write (ALL)
DROP POLICY IF EXISTS "so_write" ON public.status_overrides;
CREATE POLICY "so_write" ON public.status_overrides
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- taskos_ai_runs: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_ai_runs;
CREATE POLICY "owner_select" ON public.taskos_ai_runs
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_briefings: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_briefings;
CREATE POLICY "owner_select" ON public.taskos_briefings
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_entities: owner_delete (DELETE)
DROP POLICY IF EXISTS "owner_delete" ON public.taskos_entities;
CREATE POLICY "owner_delete" ON public.taskos_entities
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_entities: owner_insert (INSERT)
DROP POLICY IF EXISTS "owner_insert" ON public.taskos_entities;
CREATE POLICY "owner_insert" ON public.taskos_entities
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_entities: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_entities;
CREATE POLICY "owner_select" ON public.taskos_entities
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_entities: owner_update (UPDATE)
DROP POLICY IF EXISTS "owner_update" ON public.taskos_entities;
CREATE POLICY "owner_update" ON public.taskos_entities
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_goal_suggestions: taskos_goal_suggestions_owner_select (SELECT)
DROP POLICY IF EXISTS "taskos_goal_suggestions_owner_select" ON public.taskos_goal_suggestions;
CREATE POLICY "taskos_goal_suggestions_owner_select" ON public.taskos_goal_suggestions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_inbox_items: owner_delete (DELETE)
DROP POLICY IF EXISTS "owner_delete" ON public.taskos_inbox_items;
CREATE POLICY "owner_delete" ON public.taskos_inbox_items
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_inbox_items: owner_insert (INSERT)
DROP POLICY IF EXISTS "owner_insert" ON public.taskos_inbox_items;
CREATE POLICY "owner_insert" ON public.taskos_inbox_items
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_inbox_items: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_inbox_items;
CREATE POLICY "owner_select" ON public.taskos_inbox_items
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_inbox_items: owner_update (UPDATE)
DROP POLICY IF EXISTS "owner_update" ON public.taskos_inbox_items;
CREATE POLICY "owner_update" ON public.taskos_inbox_items
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_insights: owner_delete (DELETE)
DROP POLICY IF EXISTS "owner_delete" ON public.taskos_insights;
CREATE POLICY "owner_delete" ON public.taskos_insights
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_insights: owner_insert (INSERT)
DROP POLICY IF EXISTS "owner_insert" ON public.taskos_insights;
CREATE POLICY "owner_insert" ON public.taskos_insights
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_insights: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_insights;
CREATE POLICY "owner_select" ON public.taskos_insights
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_insights: owner_update (UPDATE)
DROP POLICY IF EXISTS "owner_update" ON public.taskos_insights;
CREATE POLICY "owner_update" ON public.taskos_insights
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_links: owner_delete (DELETE)
DROP POLICY IF EXISTS "owner_delete" ON public.taskos_links;
CREATE POLICY "owner_delete" ON public.taskos_links
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_links: owner_insert (INSERT)
DROP POLICY IF EXISTS "owner_insert" ON public.taskos_links;
CREATE POLICY "owner_insert" ON public.taskos_links
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_links: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_links;
CREATE POLICY "owner_select" ON public.taskos_links
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_tasks: owner_delete (DELETE)
DROP POLICY IF EXISTS "owner_delete" ON public.taskos_tasks;
CREATE POLICY "owner_delete" ON public.taskos_tasks
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_tasks: owner_insert (INSERT)
DROP POLICY IF EXISTS "owner_insert" ON public.taskos_tasks;
CREATE POLICY "owner_insert" ON public.taskos_tasks
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_tasks: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_tasks;
CREATE POLICY "owner_select" ON public.taskos_tasks
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_tasks: owner_update (UPDATE)
DROP POLICY IF EXISTS "owner_update" ON public.taskos_tasks;
CREATE POLICY "owner_update" ON public.taskos_tasks
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_telegram_links: owner_delete (DELETE)
DROP POLICY IF EXISTS "owner_delete" ON public.taskos_telegram_links;
CREATE POLICY "owner_delete" ON public.taskos_telegram_links
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_telegram_links: owner_insert (INSERT)
DROP POLICY IF EXISTS "owner_insert" ON public.taskos_telegram_links;
CREATE POLICY "owner_insert" ON public.taskos_telegram_links
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_telegram_links: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_telegram_links;
CREATE POLICY "owner_select" ON public.taskos_telegram_links
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_telegram_links: owner_update (UPDATE)
DROP POLICY IF EXISTS "owner_update" ON public.taskos_telegram_links;
CREATE POLICY "owner_update" ON public.taskos_telegram_links
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_user_settings: owner_delete (DELETE)
DROP POLICY IF EXISTS "owner_delete" ON public.taskos_user_settings;
CREATE POLICY "owner_delete" ON public.taskos_user_settings
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_user_settings: owner_insert (INSERT)
DROP POLICY IF EXISTS "owner_insert" ON public.taskos_user_settings;
CREATE POLICY "owner_insert" ON public.taskos_user_settings
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_user_settings: owner_select (SELECT)
DROP POLICY IF EXISTS "owner_select" ON public.taskos_user_settings;
CREATE POLICY "owner_select" ON public.taskos_user_settings
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- taskos_user_settings: owner_update (UPDATE)
DROP POLICY IF EXISTS "owner_update" ON public.taskos_user_settings;
CREATE POLICY "owner_update" ON public.taskos_user_settings
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_taskos_user((select auth.uid())) AS is_taskos_user)));

-- trade_network: Admins can manage trade network (ALL)
DROP POLICY IF EXISTS "Admins can manage trade network" ON public.trade_network;
CREATE POLICY "Admins can manage trade network" ON public.trade_network
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- user_roles: F&I can view all roles (SELECT)
DROP POLICY IF EXISTS "F&I can view all roles" ON public.user_roles;
CREATE POLICY "F&I can view all roles" ON public.user_roles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role)));

-- user_roles: Only admins can delete user roles (DELETE)
DROP POLICY IF EXISTS "Only admins can delete user roles" ON public.user_roles;
CREATE POLICY "Only admins can delete user roles" ON public.user_roles
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- user_roles: Only admins can insert user roles (INSERT)
DROP POLICY IF EXISTS "Only admins can insert user roles" ON public.user_roles;
CREATE POLICY "Only admins can insert user roles" ON public.user_roles
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- user_roles: Only admins can update user roles (UPDATE)
DROP POLICY IF EXISTS "Only admins can update user roles" ON public.user_roles;
CREATE POLICY "Only admins can update user roles" ON public.user_roles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- user_roles: Staff can view all roles (SELECT)
DROP POLICY IF EXISTS "Staff can view all roles" ON public.user_roles;
CREATE POLICY "Staff can view all roles" ON public.user_roles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT is_staff((select auth.uid())) AS is_staff));

-- vehicle_expenses: Admins can delete expenses (DELETE)
DROP POLICY IF EXISTS "Admins can delete expenses" ON public.vehicle_expenses;
CREATE POLICY "Admins can delete expenses" ON public.vehicle_expenses
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicle_expenses: Admins can insert expenses (INSERT)
DROP POLICY IF EXISTS "Admins can insert expenses" ON public.vehicle_expenses;
CREATE POLICY "Admins can insert expenses" ON public.vehicle_expenses
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicle_expenses: Admins can update expenses (UPDATE)
DROP POLICY IF EXISTS "Admins can update expenses" ON public.vehicle_expenses;
CREATE POLICY "Admins can update expenses" ON public.vehicle_expenses
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicle_expenses: Admins can view all expenses (SELECT)
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.vehicle_expenses;
CREATE POLICY "Admins can view all expenses" ON public.vehicle_expenses
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicle_stock_docs: Admins can delete vehicle stock docs (DELETE)
DROP POLICY IF EXISTS "Admins can delete vehicle stock docs" ON public.vehicle_stock_docs;
CREATE POLICY "Admins can delete vehicle stock docs" ON public.vehicle_stock_docs
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicles: Accountants can view vehicles (SELECT)
DROP POLICY IF EXISTS "Accountants can view vehicles" ON public.vehicles;
CREATE POLICY "Accountants can view vehicles" ON public.vehicles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role));

-- vehicles: Admins can delete vehicles (DELETE)
DROP POLICY IF EXISTS "Admins can delete vehicles" ON public.vehicles;
CREATE POLICY "Admins can delete vehicles" ON public.vehicles
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicles: Admins can insert vehicles (INSERT)
DROP POLICY IF EXISTS "Admins can insert vehicles" ON public.vehicles;
CREATE POLICY "Admins can insert vehicles" ON public.vehicles
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicles: Admins can update vehicles (UPDATE)
DROP POLICY IF EXISTS "Admins can update vehicles" ON public.vehicles;
CREATE POLICY "Admins can update vehicles" ON public.vehicles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicles: Admins can view vehicles (SELECT)
DROP POLICY IF EXISTS "Admins can view vehicles" ON public.vehicles;
CREATE POLICY "Admins can view vehicles" ON public.vehicles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vehicles: Sales agents can insert vehicles (INSERT)
DROP POLICY IF EXISTS "Sales agents can insert vehicles" ON public.vehicles;
CREATE POLICY "Sales agents can insert vehicles" ON public.vehicles
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- vehicles: Sales agents can update vehicles (UPDATE)
DROP POLICY IF EXISTS "Sales agents can update vehicles" ON public.vehicles;
CREATE POLICY "Sales agents can update vehicles" ON public.vehicles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- vehicles: Sales agents can view vehicles (SELECT)
DROP POLICY IF EXISTS "Sales agents can view vehicles" ON public.vehicles;
CREATE POLICY "Sales agents can view vehicles" ON public.vehicles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- vendor_documents: Managers delete vendor docs (DELETE)
DROP POLICY IF EXISTS "Managers delete vendor docs" ON public.vendor_documents;
CREATE POLICY "Managers delete vendor docs" ON public.vendor_documents
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- vendor_documents: Managers insert vendor docs (INSERT)
DROP POLICY IF EXISTS "Managers insert vendor docs" ON public.vendor_documents;
CREATE POLICY "Managers insert vendor docs" ON public.vendor_documents
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- vendor_documents: Staff view vendor docs (SELECT)
DROP POLICY IF EXISTS "Staff view vendor docs" ON public.vendor_documents;
CREATE POLICY "Staff view vendor docs" ON public.vendor_documents
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role)));

-- vendors: Admins delete vendors (DELETE)
DROP POLICY IF EXISTS "Admins delete vendors" ON public.vendors;
CREATE POLICY "Admins delete vendors" ON public.vendors
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- vendors: Managers insert vendors (INSERT)
DROP POLICY IF EXISTS "Managers insert vendors" ON public.vendors;
CREATE POLICY "Managers insert vendors" ON public.vendors
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- vendors: Managers update vendors (UPDATE)
DROP POLICY IF EXISTS "Managers update vendors" ON public.vendors;
CREATE POLICY "Managers update vendors" ON public.vendors
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role)));

-- vendors: Staff view vendors (SELECT)
DROP POLICY IF EXISTS "Staff view vendors" ON public.vendors;
CREATE POLICY "Staff view vendors" ON public.vendors
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'accountant'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'senior_f_and_i'::app_role) AS has_role) OR ( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role)));

-- webhook_events: Admins can view webhook events (SELECT)
DROP POLICY IF EXISTS "Admins can view webhook events" ON public.webhook_events;
CREATE POLICY "Admins can view webhook events" ON public.webhook_events
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- whatsapp_messages: Admins can view whatsapp messages (SELECT)
DROP POLICY IF EXISTS "Admins can view whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Admins can view whatsapp messages" ON public.whatsapp_messages
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

-- whatsapp_messages: Sales agents can view whatsapp messages (SELECT)
DROP POLICY IF EXISTS "Sales agents can view whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Sales agents can view whatsapp messages" ON public.whatsapp_messages
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'sales_agent'::app_role) AS has_role));

-- whatsapp_templates: wt_select (SELECT)
DROP POLICY IF EXISTS "wt_select" ON public.whatsapp_templates;
CREATE POLICY "wt_select" ON public.whatsapp_templates
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (( SELECT is_staff((select auth.uid())) AS is_staff));

-- whatsapp_templates: wt_write (ALL)
DROP POLICY IF EXISTS "wt_write" ON public.whatsapp_templates;
CREATE POLICY "wt_write" ON public.whatsapp_templates
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  WITH CHECK (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));
