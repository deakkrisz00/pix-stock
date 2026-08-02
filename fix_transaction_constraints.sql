-- ============================================================
-- PIX STOCK – Fix transaction constraints
-- Futtatsd ezt a Supabase SQL Editorban!
-- ============================================================

-- Töröljük az eddigi szigorú ellenőrzéseket, hogy ne blokkolja az új funkciókat
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_booth_check;

-- Opcionális: Ha nagyon akarjuk a védelmet, hozzáadjuk az ÖSSZES lehetséges típussal
-- (beleértve a selejtet, összeírást, stb.)
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('feltoltes', 'visszavetel', 'korrekcio', 'leltar', 'kivisz', 'selejt', 'osszeiras', 'visszahoz', 'rendeles'));

ALTER TABLE public.transactions ADD CONSTRAINT transactions_booth_check 
  CHECK (booth IN ('bazar', 'fenti', 'kozponti', 'mindketto', 'admin'));
