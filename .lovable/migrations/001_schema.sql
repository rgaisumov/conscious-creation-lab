-- Production Management System schema
-- Multi-user web app with roles and server-side data storage

-- Reset idempotent for initial setup
DROP TYPE IF EXISTS public.app_role CASCADE;

CREATE TYPE public.app_role AS ENUM ('admin', 'production_manager', 'workcenter_master', 'viewer');

-- User roles (separate table, never on profiles)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
$$;

CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read their own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Profiles (user-facing data)
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text,
    role_title text,
    department text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage their own profile" ON public.profiles
FOR ALL TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bootstrap: the very first user who signs up becomes admin
DROP FUNCTION IF EXISTS public.handle_first_user_admin();

CREATE OR REPLACE FUNCTION public.handle_first_user_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_first_admin ON auth.users;

CREATE TRIGGER on_auth_user_first_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_first_user_admin();

-- Workcenters (production units)
CREATE TABLE public.workcenters (
    id text PRIMARY KEY,
    name text NOT NULL,
    workers integer NOT NULL DEFAULT 1,
    hours_per_worker_per_week integer NOT NULL DEFAULT 40,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.workcenters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workcenters TO authenticated;
GRANT ALL ON public.workcenters TO service_role;

ALTER TABLE public.workcenters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view workcenters" ON public.workcenters
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage workcenters" ON public.workcenters
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

-- Transfer times between route nodes
CREATE TABLE public.transfer_times (
    id text PRIMARY KEY,
    from_node text NOT NULL,
    to_node text NOT NULL,
    hours numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (from_node, to_node)
);

GRANT SELECT ON public.transfer_times TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_times TO authenticated;
GRANT ALL ON public.transfer_times TO service_role;

ALTER TABLE public.transfer_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view transfer times" ON public.transfer_times
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage transfer times" ON public.transfer_times
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

-- Products (manufacturing templates)
CREATE TABLE public.products (
    id text PRIMARY KEY,
    name text NOT NULL,
    version text NOT NULL DEFAULT 'v1.0',
    note text,
    archived boolean NOT NULL DEFAULT false,
    assembled_operation_id text,
    tested_operation_id text,
    components jsonb NOT NULL DEFAULT '[]'::jsonb,
    operations jsonb NOT NULL DEFAULT '[]'::jsonb,
    operation_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products" ON public.products
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage products" ON public.products
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

-- Batches (manufacturing execution)
CREATE TABLE public.batches (
    id text PRIMARY KEY,
    product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    number text NOT NULL,
    ordered_qty integer NOT NULL DEFAULT 1,
    shipped_qty integer NOT NULL DEFAULT 0,
    due_date date NOT NULL,
    note text,
    completed jsonb NOT NULL DEFAULT '{}'::jsonb,
    route_override jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view batches" ON public.batches
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage batches" ON public.batches
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

CREATE POLICY "Workcenter masters can update batch progress" ON public.batches
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'workcenter_master'))
WITH CHECK (public.has_role(auth.uid(), 'workcenter_master'));

-- Contracts
CREATE TABLE public.contracts (
    id text PRIMARY KEY,
    number text NOT NULL,
    counterparty text NOT NULL,
    product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    decimal_number text NOT NULL,
    signed_date date NOT NULL,
    note text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view contracts" ON public.contracts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage contracts" ON public.contracts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

-- Contract deliveries
CREATE TABLE public.contract_deliveries (
    id text PRIMARY KEY,
    contract_id text NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    date date NOT NULL,
    quantity integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.contract_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_deliveries TO authenticated;
GRANT ALL ON public.contract_deliveries TO service_role;

ALTER TABLE public.contract_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view deliveries" ON public.contract_deliveries
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage deliveries" ON public.contract_deliveries
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

-- Delivery-batch links (many-to-many)
CREATE TABLE public.delivery_batches (
    delivery_id text NOT NULL REFERENCES public.contract_deliveries(id) ON DELETE CASCADE,
    batch_id text NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    PRIMARY KEY (delivery_id, batch_id)
);

GRANT SELECT ON public.delivery_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_batches TO authenticated;
GRANT ALL ON public.delivery_batches TO service_role;

ALTER TABLE public.delivery_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view delivery links" ON public.delivery_batches
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage delivery links" ON public.delivery_batches
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

-- Updated_at triggers
DROP FUNCTION IF EXISTS public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_workcenters_updated_at ON public.workcenters;
DROP TRIGGER IF EXISTS update_transfer_times_updated_at ON public.transfer_times;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS update_batches_updated_at ON public.batches;
DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

CREATE TRIGGER update_workcenters_updated_at BEFORE UPDATE ON public.workcenters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transfer_times_updated_at BEFORE UPDATE ON public.transfer_times
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
