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

-- Seed workcenters
INSERT INTO public.workcenters (id, name, workers, hours_per_worker_per_week) VALUES
('wc-payka', 'Участок пайки', 4, 40),
('wc-sborka', 'Участок сборки', 3, 40),
('wc-proverka', 'Участок проверки', 2, 40),
('wc-lak', 'Участок лакировки', 1, 40),
('wc-ispyt', 'Участок испытаний', 2, 40),
('wc-upak', 'Участок упаковки', 1, 40)
ON CONFLICT (id) DO NOTHING;

-- Seed transfer times
INSERT INTO public.transfer_times (id, from_node, to_node, hours) VALUES
('tt-1', 'wc-payka', 'wc-sborka', 2),
('tt-2', 'wc-sborka', 'wc-proverka', 1),
('tt-3', 'wc-proverka', 'wc-lak', 2),
('tt-4', 'wc-lak', 'wc-proverka', 2),
('tt-5', 'wc-proverka', 'wc-ispyt', 3),
('tt-6', 'wc-ispyt', 'wc-upak', 1)
ON CONFLICT (id) DO NOTHING;

-- Seed product 1 (Изделие №1)
INSERT INTO public.products (
    id, name, version, note, assembled_operation_id, tested_operation_id,
    operation_groups, components, operations
) VALUES (
    'izdelie-1',
    'Изделие №1',
    'рев. B',
    'Базовый блок управления. Серийное производство.',
    'sborka',
    'ispyt-elektro',
    '[{"id":"grp-ispytaniya","name":"Испытания"}]'::jsonb,
    '[
      {"id":"plata","name":"Плата","type":"material","positions":[{"id":"plata-1","name":"Плата основная","quantityPerUnit":1,"stock":100,"leadTimeDays":7,"supplier":"Резонит"}]},
      {"id":"tekhn-plata","name":"Технологическая плата","type":"material","positions":[{"id":"tp-1","name":"Технологическая плата","quantityPerUnit":1,"stock":100,"leadTimeDays":5,"supplier":"Резонит"}]},
      {"id":"eri","name":"ЭРИ","type":"eri","positions":[{"id":"eri-1","name":"Резистор 10к","quantityPerUnit":4,"stock":500,"leadTimeDays":3,"supplier":"Чип и Дип"},{"id":"eri-2","name":"Конденсатор 100нФ","quantityPerUnit":3,"stock":400,"leadTimeDays":3,"supplier":"Чип и Дип"},{"id":"eri-3","name":"Микроконтроллер STM32","quantityPerUnit":1,"stock":40,"leadTimeDays":21,"supplier":"Компэл","note":"Дефицитная позиция, длинный срок поставки"}]},
      {"id":"detali","name":"Детали","type":"material","positions":[{"id":"det-1","name":"Винт М3","quantityPerUnit":4,"stock":800,"leadTimeDays":2,"supplier":"Метизы"},{"id":"det-2","name":"Шайба М3","quantityPerUnit":4,"stock":800,"leadTimeDays":2,"supplier":"Метизы"},{"id":"det-3","name":"Гайка М3","quantityPerUnit":2,"stock":500,"leadTimeDays":2,"supplier":"Метизы"}]},
      {"id":"materialy","name":"Материалы","type":"material","positions":[{"id":"mat-1","name":"Припой ПОС-61, г","quantityPerUnit":10,"stock":1500,"leadTimeDays":4},{"id":"mat-2","name":"Флюс, мл","quantityPerUnit":2,"stock":300,"leadTimeDays":4}]},
      {"id":"lak","name":"Лак защитный","type":"material","positions":[{"id":"lak-1","name":"Лак УР-231, мл","quantityPerUnit":5,"stock":500,"leadTimeDays":5}]},
      {"id":"upakovka","name":"Упаковка","type":"material","positions":[{"id":"up-1","name":"Коробка транспортная","quantityPerUnit":1,"stock":30,"leadTimeDays":5,"supplier":"Тара-Сервис"}]},
      {"id":"osn-zagibaniya","name":"Оснастка загибания","type":"fixture","fixtureCount":5,"positions":[]},
      {"id":"osn-raspayki","name":"Оснастка распайки","type":"fixture","fixtureCount":2,"positions":[]},
      {"id":"osn-khraneniya","name":"Оснастка хранения","type":"fixture","fixtureCount":4,"positions":[]},
      {"id":"osn-vibro","name":"Оснастка вибро","type":"fixture","fixtureCount":0,"positions":[],"note":"Единственный комплект на ремонте"},
      {"id":"sp-montazh","name":"Плата после монтажа","type":"semi-product","producedByOperationId":"montazh","positions":[]},
      {"id":"sp-sborka","name":"Изделие в сборе","type":"semi-product","producedByOperationId":"sborka","positions":[]},
      {"id":"sp-proverka-1","name":"После проверки 1","type":"semi-product","producedByOperationId":"proverka-1","positions":[]},
      {"id":"sp-lak","name":"Лакированное изделие","type":"semi-product","producedByOperationId":"lakirovka","positions":[]},
      {"id":"sp-proverka-2","name":"После проверки 2","type":"semi-product","producedByOperationId":"proverka-2","positions":[]},
      {"id":"sp-klimat","name":"После климатики","type":"semi-product","producedByOperationId":"ispyt-klimat","positions":[]},
      {"id":"sp-vibro","name":"После вибро","type":"semi-product","producedByOperationId":"ispyt-vibro","positions":[]},
      {"id":"sp-ispytaniya","name":"После испытаний","type":"semi-product","producedByOperationId":"ispyt-elektro","positions":[]}
    ]'::jsonb,
    '[
      {"id":"montazh","workcenterId":"wc-payka","name":"Монтаж","responsible":"Иванов И.И.","durationHours":8,"order":1,"inputComponentIds":["plata","tekhn-plata","eri"],"outputComponentId":"sp-montazh","note":"Пайка ЭРИ на плату"},
      {"id":"sborka","workcenterId":"wc-sborka","name":"Сборка","responsible":"Петров П.П.","durationHours":4,"order":2,"inputComponentIds":["sp-montazh","detali","materialy","osn-zagibaniya","osn-raspayki"],"outputComponentId":"sp-sborka"},
      {"id":"proverka-1","workcenterId":"wc-proverka","name":"Проверка 1","responsible":"Сидоров С.С.","durationHours":2,"order":3,"inputComponentIds":["sp-sborka","osn-khraneniya"],"outputComponentId":"sp-proverka-1"},
      {"id":"lakirovka","workcenterId":"wc-lak","name":"Лакировка","responsible":"Кузнецов К.К.","durationHours":3,"order":4,"inputComponentIds":["sp-proverka-1","lak"],"outputComponentId":"sp-lak"},
      {"id":"proverka-2","workcenterId":"wc-proverka","name":"Проверка 2","responsible":"Сидоров С.С.","durationHours":2,"order":5,"inputComponentIds":["sp-lak"],"outputComponentId":"sp-proverka-2"},
      {"id":"ispyt-klimat","workcenterId":"wc-ispyt","name":"Климатические","responsible":"Николаев Н.Н.","durationHours":3,"order":6,"groupId":"grp-ispytaniya","inputComponentIds":["sp-proverka-2"],"outputComponentId":"sp-klimat"},
      {"id":"ispyt-vibro","workcenterId":"wc-ispyt","name":"Вибрационные","responsible":"Николаев Н.Н.","durationHours":2,"order":7,"groupId":"grp-ispytaniya","inputComponentIds":["sp-klimat","osn-vibro"],"outputComponentId":"sp-vibro","note":"Требуется вибростенд и оснастка вибро"},
      {"id":"ispyt-elektro","workcenterId":"wc-ispyt","name":"Электрические","responsible":"Николаев Н.Н.","durationHours":1,"order":8,"groupId":"grp-ispytaniya","inputComponentIds":["sp-vibro"],"outputComponentId":"sp-ispytaniya"},
      {"id":"upakovka-op","workcenterId":"wc-upak","name":"Упаковка","responsible":"Фёдоров Ф.Ф.","durationHours":1,"order":9,"inputComponentIds":["sp-ispytaniya","upakovka"],"outputComponentId":null}
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    note = EXCLUDED.note,
    assembled_operation_id = EXCLUDED.assembled_operation_id,
    tested_operation_id = EXCLUDED.tested_operation_id,
    operation_groups = EXCLUDED.operation_groups,
    components = EXCLUDED.components,
    operations = EXCLUDED.operations;

-- Seed product 2 (Изделие №2)
INSERT INTO public.products (
    id, name, version, note, assembled_operation_id, tested_operation_id,
    operation_groups, components, operations
) VALUES (
    'izdelie-2',
    'Изделие №2',
    'рев. A',
    'Датчик температуры, малосерийный.',
    'd-sborka',
    'd-ispytaniya',
    '[]'::jsonb,
    '[
      {"id":"d-plata","name":"Плата датчика","type":"material","positions":[{"id":"d-plata-1","name":"Плата PT-100","quantityPerUnit":1,"stock":60,"leadTimeDays":10,"supplier":"Резонит"}]},
      {"id":"d-eri","name":"ЭРИ","type":"eri","positions":[{"id":"d-eri-1","name":"Термодатчик PT100","quantityPerUnit":1,"stock":60,"leadTimeDays":14,"supplier":"Компэл"},{"id":"d-eri-2","name":"Резистор 1к","quantityPerUnit":2,"stock":400,"leadTimeDays":3}]},
      {"id":"d-korpus","name":"Корпус","type":"material","positions":[{"id":"d-korpus-1","name":"Корпус IP65","quantityPerUnit":1,"stock":50,"leadTimeDays":12,"supplier":"Гаусс"}]},
      {"id":"d-osn","name":"Оснастка сборки","type":"fixture","fixtureCount":2,"positions":[]},
      {"id":"d-sp-montazh","name":"Плата после монтажа","type":"semi-product","producedByOperationId":"d-montazh","positions":[]},
      {"id":"d-sp-sborka","name":"Датчик в сборе","type":"semi-product","producedByOperationId":"d-sborka","positions":[]},
      {"id":"d-sp-ispyt","name":"После испытаний","type":"semi-product","producedByOperationId":"d-ispytaniya","positions":[]}
    ]'::jsonb,
    '[
      {"id":"d-montazh","workcenterId":"wc-payka","name":"Монтаж","responsible":"Иванов И.И.","durationHours":5,"order":1,"inputComponentIds":["d-plata","d-eri"],"outputComponentId":"d-sp-montazh"},
      {"id":"d-sborka","workcenterId":"wc-sborka","name":"Сборка","responsible":"Петров П.П.","durationHours":3,"order":2,"inputComponentIds":["d-sp-montazh","d-korpus","d-osn"],"outputComponentId":"d-sp-sborka"},
      {"id":"d-ispytaniya","workcenterId":"wc-ispyt","name":"Испытания","responsible":"Николаев Н.Н.","durationHours":4,"order":3,"inputComponentIds":["d-sp-sborka"],"outputComponentId":"d-sp-ispyt"}
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    note = EXCLUDED.note,
    assembled_operation_id = EXCLUDED.assembled_operation_id,
    tested_operation_id = EXCLUDED.tested_operation_id,
    operation_groups = EXCLUDED.operation_groups,
    components = EXCLUDED.components,
    operations = EXCLUDED.operations;

-- Seed batches
INSERT INTO public.batches (id, product_id, number, ordered_qty, shipped_qty, due_date, note, completed) VALUES
('b-1-24', 'izdelie-1', 'П-2026/024', 100, 5, '2026-07-20', 'Заказ по договору №118', '{"montazh":40,"sborka":25,"proverka-1":20,"lakirovka":15,"proverka-2":10,"ispyt-klimat":8,"ispyt-vibro":6,"ispyt-elektro":6,"upakovka-op":5}'::jsonb),
('b-1-25', 'izdelie-1', 'П-2026/025', 50, 0, '2026-09-15', '', '{"montazh":10}'::jsonb),
('b-2-07', 'izdelie-2', 'Д-2026/007', 40, 0, '2026-08-05', '', '{"d-montazh":30,"d-sborka":22,"d-ispytaniya":18}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    number = EXCLUDED.number,
    ordered_qty = EXCLUDED.ordered_qty,
    shipped_qty = EXCLUDED.shipped_qty,
    due_date = EXCLUDED.due_date,
    note = EXCLUDED.note,
    completed = EXCLUDED.completed;

-- Seed contracts
INSERT INTO public.contracts (id, number, counterparty, product_id, decimal_number, signed_date, note) VALUES
('c-118', '№118/2026', 'АО "Заказчик-1"', 'izdelie-1', 'АБВГ.464349.001', '2026-02-10', ''),
('c-204', '№204/2026', 'ООО "Заказчик-2"', 'izdelie-2', 'АБВГ.464349.002', '2026-04-02', '')
ON CONFLICT (id) DO UPDATE SET
    number = EXCLUDED.number,
    counterparty = EXCLUDED.counterparty,
    product_id = EXCLUDED.product_id,
    decimal_number = EXCLUDED.decimal_number,
    signed_date = EXCLUDED.signed_date,
    note = EXCLUDED.note;

INSERT INTO public.contract_deliveries (id, contract_id, date, quantity) VALUES
('c-118-d1', 'c-118', '2026-07-31', 100),
('c-118-d2', 'c-118', '2026-10-31', 50),
('c-204-d1', 'c-204', '2026-11-30', 40)
ON CONFLICT (id) DO UPDATE SET
    contract_id = EXCLUDED.contract_id,
    date = EXCLUDED.date,
    quantity = EXCLUDED.quantity;

INSERT INTO public.delivery_batches (delivery_id, batch_id) VALUES
('c-118-d1', 'b-1-24'),
('c-118-d2', 'b-1-25')
ON CONFLICT (delivery_id, batch_id) DO NOTHING;
