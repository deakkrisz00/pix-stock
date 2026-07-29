-- 1. Engedélyezzük a Row Level Security-t a categories táblán
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. Töröljük a régi policy-kat (ha esetleg lennének)
DROP POLICY IF EXISTS "categories_select_anon" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_anon" ON public.categories;
DROP POLICY IF EXISTS "categories_update_anon" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_anon" ON public.categories;

-- 3. Hozzuk létre az új, nyílt policy-kat (mivel a PIN kódos védelem az appban van)
CREATE POLICY "categories_select_anon" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories_insert_anon" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "categories_update_anon" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "categories_delete_anon" ON public.categories FOR DELETE USING (true);
