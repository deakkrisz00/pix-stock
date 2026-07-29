-- 1. Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  note text,
  items jsonb NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "orders_select_anon" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_anon" ON public.orders;
DROP POLICY IF EXISTS "orders_update_anon" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_anon" ON public.orders;

-- 4. Create policies
CREATE POLICY "orders_select_anon" ON public.orders FOR SELECT USING (true);
CREATE POLICY "orders_insert_anon" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update_anon" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "orders_delete_anon" ON public.orders FOR DELETE USING (true);
