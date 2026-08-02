-- ============================================================
-- PIX STOCK – Add 'selejt' transaction type
-- Futtatsd a Supabase SQL Editorban
-- ============================================================

-- 1. Drop existing constraint if it exists (it's implicitly created, usually named transactions_type_check)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- 2. Add the new constraint including 'selejt' and 'kivisz'
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('feltoltes', 'visszavetel', 'korrekcio', 'leltar', 'kivisz', 'selejt'));

-- Ellenőrzés: 
-- Ha esetleg más néven jött létre a check constraint a Supabase-ben, akkor a fenti DROP hibát dobhat (bár IF EXISTS miatt elvileg nem), 
-- vagy nem droppolja az eredetit. Ebben az esetben kézzel kell droppolni a régit.
