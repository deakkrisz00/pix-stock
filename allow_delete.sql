-- 1. Transactions tábla type mezőjének javítása (hogy a 'rendeles' is hivatalosan engedélyezett legyen)
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('kivisz', 'visszahoz', 'feltoltes', 'visszavetel', 'korrekcio', 'leltar', 'rendeles'));

-- 2. Törlési (DELETE) jog hozzáadása a tranzakciók táblához
DROP POLICY IF EXISTS "transactions_delete_anon" ON public.transactions;

CREATE POLICY "transactions_delete_anon" ON public.transactions FOR DELETE USING (true);
