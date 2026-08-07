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
