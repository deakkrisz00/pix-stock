-- Ezt a szkriptet a Supabase SQL Editorban futtasd le
-- Kijavítja a régi tranzakciókban és leltárakban a hibásan elmentett 'deniela' és 'daniela' neveket 'Daniela'-ra.

-- 1. Transactions tábla javítása
UPDATE public.transactions
SET items = (
    SELECT jsonb_agg(
        CASE
            WHEN (elem->>'name') ILIKE 'deniela' OR (elem->>'name') ILIKE 'daniela' THEN jsonb_set(elem, '{name}', '"Daniela"')
            ELSE elem
        END
    )
    FROM jsonb_array_elements(items) AS elem
)
WHERE items @> '[{"name": "deniela"}]' OR items @> '[{"name": "Deniela"}]' OR items @> '[{"name": "daniela"}]' OR items @> '[{"name": "Daniela"}]';

-- 2. Inventory_sessions tábla javítása
UPDATE public.inventory_sessions
SET counted_items = (
    SELECT jsonb_agg(
        CASE
            WHEN (elem->>'name') ILIKE 'deniela' OR (elem->>'name') ILIKE 'daniela' THEN jsonb_set(elem, '{name}', '"Daniela"')
            ELSE elem
        END
    )
    FROM jsonb_array_elements(counted_items) AS elem
)
WHERE counted_items @> '[{"name": "deniela"}]' OR counted_items @> '[{"name": "Deniela"}]' OR counted_items @> '[{"name": "daniela"}]' OR counted_items @> '[{"name": "Daniela"}]';

-- 3. Names tábla javítása (összevonás, ha a Daniela már létezik)
DO $$ 
DECLARE
    correct_id uuid;
    wrong_rec record;
BEGIN
    -- Lekérjük a helyes 'Daniela' ID-ját
    SELECT id INTO correct_id FROM public.names WHERE name = 'Daniela' LIMIT 1;
    
    IF correct_id IS NULL THEN
        -- Ha egyáltalán nincs 'Daniela' nevű sor, simán átnevezzük
        UPDATE public.names SET name = 'Daniela' WHERE name ILIKE 'deniela' OR name = 'daniela';
    ELSE
        -- Ha már van 'Daniela', akkor összeadjuk a készletet és töröljük a felesleges sort
        FOR wrong_rec IN 
            SELECT id, central_stock, bazar_stock, fenti_stock 
            FROM public.names 
            WHERE (name ILIKE 'deniela' OR name = 'daniela') AND id != correct_id
        LOOP
            -- Készlet hozzáadása
            UPDATE public.names 
            SET 
                central_stock = COALESCE(central_stock, 0) + COALESCE(wrong_rec.central_stock, 0),
                bazar_stock = COALESCE(bazar_stock, 0) + COALESCE(wrong_rec.bazar_stock, 0),
                fenti_stock = COALESCE(fenti_stock, 0) + COALESCE(wrong_rec.fenti_stock, 0)
            WHERE id = correct_id;
            
            -- Régi (hibás) sor törlése
            DELETE FROM public.names WHERE id = wrong_rec.id;
        END LOOP;
    END IF;
END $$;
