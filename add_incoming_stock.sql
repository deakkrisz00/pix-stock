-- 1. Új oszlop hozzáadása az 'incoming_stock' nyilvántartására
ALTER TABLE public.names
  ADD COLUMN IF NOT EXISTS incoming_stock INTEGER NOT NULL DEFAULT 0;
