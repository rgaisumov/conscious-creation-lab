CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  unit text NOT NULL DEFAULT 'шт',
  available numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  required numeric NOT NULL DEFAULT 0,
  reserved numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stock_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  expected_date date,
  received boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items, public.stock_reservations, public.stock_orders TO authenticated;
GRANT ALL ON public.stock_items, public.stock_reservations, public.stock_orders TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read stock" ON public.stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "edit stock" ON public.stock_items FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(),'warehouse')) WITH CHECK (public.can_edit_section(auth.uid(),'warehouse'));
CREATE POLICY "read res" ON public.stock_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "edit res" ON public.stock_reservations FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(),'warehouse')) WITH CHECK (public.can_edit_section(auth.uid(),'warehouse'));
CREATE POLICY "read ord" ON public.stock_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "edit ord" ON public.stock_orders FOR ALL TO authenticated USING (public.can_edit_section(auth.uid(),'warehouse')) WITH CHECK (public.can_edit_section(auth.uid(),'warehouse'));