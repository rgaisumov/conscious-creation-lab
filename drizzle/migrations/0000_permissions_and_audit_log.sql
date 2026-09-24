ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login text;

CREATE TABLE public.section_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL,
  can_edit boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, section)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.section_permissions TO authenticated;
GRANT ALL ON public.section_permissions TO service_role;
ALTER TABLE public.section_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own permissions" ON public.section_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage permissions" ON public.section_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.can_edit_section(_user_id uuid, _section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.section_permissions WHERE user_id = _user_id AND section = _section AND can_edit
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_edit_section(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_section(uuid, text) TO authenticated;

CREATE POLICY "Section editors manage batches" ON public.batches FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(), 'production')) WITH CHECK (public.can_edit_section(auth.uid(), 'production'));
CREATE POLICY "Section editors manage products" ON public.products FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(), 'products')) WITH CHECK (public.can_edit_section(auth.uid(), 'products'));
CREATE POLICY "Section editors manage workcenters" ON public.workcenters FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(), 'workcenters')) WITH CHECK (public.can_edit_section(auth.uid(), 'workcenters'));
CREATE POLICY "Section editors manage transfers" ON public.transfer_times FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(), 'workcenters')) WITH CHECK (public.can_edit_section(auth.uid(), 'workcenters'));
CREATE POLICY "Section editors manage contracts" ON public.contracts FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(), 'contracts')) WITH CHECK (public.can_edit_section(auth.uid(), 'contracts'));
CREATE POLICY "Section editors manage deliveries" ON public.contract_deliveries FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(), 'contracts')) WITH CHECK (public.can_edit_section(auth.uid(), 'contracts'));
CREATE POLICY "Section editors manage delivery links" ON public.delivery_batches FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(), 'contracts')) WITH CHECK (public.can_edit_section(auth.uid(), 'contracts'));

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  user_name text,
  section text NOT NULL,
  action text NOT NULL,
  entity text
);
CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read log" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users write own log entries" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);