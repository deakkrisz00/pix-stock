-- ============================================================
-- PIX STOCK – RLS ÉS SÉMA JAVÍTÁS
-- Másold be a Supabase SQL Editorba és futtasd le!
-- ============================================================

-- 1. Transactions tábla type mezőjének javítása
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('kivisz', 'visszahoz', 'feltoltes', 'visszavetel', 'korrekcio', 'leltar'));

-- 2. Transactions tábla booth mezőjének javítása
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_booth_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_booth_check
  CHECK (booth IN ('bazar', 'fenti', 'kozponti', 'mindketto'));

-- 3. RLS – Nyílt hozzáférés az anon kulcsnak
--    (az app PIN-alapú, nem Supabase Auth alapú, csak privát hálózaton fut)

-- Names tábla
DROP POLICY IF EXISTS "names_select_all"    ON public.names;
DROP POLICY IF EXISTS "names_insert_admin"  ON public.names;
DROP POLICY IF EXISTS "names_update_all"    ON public.names;
DROP POLICY IF EXISTS "names_delete_admin"  ON public.names;
DROP POLICY IF EXISTS "names_select_anon"   ON public.names;
DROP POLICY IF EXISTS "names_insert_anon"   ON public.names;
DROP POLICY IF EXISTS "names_update_anon"   ON public.names;
DROP POLICY IF EXISTS "names_delete_anon"   ON public.names;

CREATE POLICY "names_select_anon"  ON public.names FOR SELECT  USING (true);
CREATE POLICY "names_insert_anon"  ON public.names FOR INSERT  WITH CHECK (true);
CREATE POLICY "names_update_anon"  ON public.names FOR UPDATE  USING (true);
CREATE POLICY "names_delete_anon"  ON public.names FOR DELETE  USING (true);

-- Transactions tábla
DROP POLICY IF EXISTS "transactions_select"      ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert"      ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_anon" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_anon" ON public.transactions;

CREATE POLICY "transactions_select_anon" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "transactions_insert_anon" ON public.transactions FOR INSERT WITH CHECK (true);

-- 4. Ellenőrzés – megjelenik az összes érvényes policy
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


