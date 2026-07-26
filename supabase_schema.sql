-- ============================================================
-- PIX STOCK – Supabase SQL Séma
-- Futtatsd a Supabase SQL Editorban
-- ============================================================

-- 1. Profiles tábla (felhasználói szerepkörök)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Names tábla (névlista + készletek)
CREATE TABLE IF NOT EXISTS public.names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  central_stock INTEGER NOT NULL DEFAULT 0 CHECK (central_stock >= 0),
  bazar_stock INTEGER NOT NULL DEFAULT 0 CHECK (bazar_stock >= 0),
  fenti_stock INTEGER NOT NULL DEFAULT 0 CHECK (fenti_stock >= 0),
  min_stock INTEGER DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Transactions tábla (napló)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('feltoltes', 'visszavetel', 'korrekcio', 'leltar')),
  booth TEXT NOT NULL CHECK (booth IN ('bazar', 'fenti', 'kozponti', 'mindketto')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Inventory Sessions tábla (leltár munkamenetek)
CREATE TABLE IF NOT EXISTS public.inventory_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booth TEXT NOT NULL CHECK (booth IN ('bazar', 'fenti', 'kozponti')),
  counted_items JSONB NOT NULL DEFAULT '[]',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT trigger a names táblához
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.names;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.names
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 'worker')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles: saját profilt mindenki látja, admin látja az összeset
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Names: mindenki olvashat, admin módosíthat
CREATE POLICY "names_select_all" ON public.names FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "names_insert_admin" ON public.names FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "names_update_all" ON public.names FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "names_delete_admin" ON public.names FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Transactions: mindenki olvashat/írhat (bejelentkezett)
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Inventory sessions: mindenki olvashat/írhat
CREATE POLICY "inventory_select" ON public.inventory_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "inventory_insert" ON public.inventory_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Realtime engedélyezés
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.names;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
