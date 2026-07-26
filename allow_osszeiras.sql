-- ============================================================
-- PIX STOCK – ÚJ TRANZAKCIÓ TÍPUS ENGEDÉLYEZÉSE
-- Másold be a Supabase SQL Editorba és futtasd le!
-- ============================================================

-- 1. Transactions tábla type mezőjének javítása
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('kivisz', 'visszahoz', 'feltoltes', 'visszavetel', 'korrekcio', 'leltar', 'rendeles', 'osszeiras'));
