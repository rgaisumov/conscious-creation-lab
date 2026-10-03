CREATE TABLE public.stock_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_groups TO authenticated;
GRANT ALL ON public.stock_groups TO service_role;
ALTER TABLE public.stock_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read stock groups" ON public.stock_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "edit stock groups" ON public.stock_groups FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(), 'warehouse'::text)) WITH CHECK (public.can_edit_section(auth.uid(), 'warehouse'::text));
ALTER TABLE public.stock_items ADD COLUMN group_id uuid REFERENCES public.stock_groups(id) ON DELETE SET NULL;
CREATE INDEX stock_items_group_id_idx ON public.stock_items(group_id);