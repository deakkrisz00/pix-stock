-- ==============================================================================
-- Kategóriák automatikus frissítése az "összes eddigi eladás" (kivitt + selejt) alapján
-- Felosztás (10%-os verzió, 5 kategória):
-- A: Top 5 név (Abszolút Top - 2,5%)
-- B: Következő 10% (Kiválóak)
-- C: Következő 23,5% (Erős közép)
-- D: Következő 30% (Gyengébb közép)
-- E: Maradék ~34% (Vesztesek)
-- ==============================================================================

WITH eladas_statisztika AS (
  -- 1. Lépés: Kiszámoljuk az összes eddigi eladást névenként a tranzakciókból
  SELECT 
    n.name,
    COALESCE(SUM(
      CASE 
        WHEN t.type = 'kivisz' THEN (item->>'qty')::int
        WHEN t.type = 'selejt' AND t.booth != 'kozponti' THEN -((item->>'qty')::int)
        ELSE 0 
      END
    ), 0) AS total_sold
  FROM public.names n
  LEFT JOIN public.transactions t ON t.type IN ('kivisz', 'selejt')
  LEFT JOIN LATERAL jsonb_array_elements(t.items) AS item ON item->>'name' = n.name
  GROUP BY n.name
),
rangsorolas AS (
  -- 2. Lépés: Rangsoroljuk a neveket az eladások alapján (legtöbbtől a legkevesebbig)
  SELECT 
    name,
    total_sold,
    RANK() OVER (ORDER BY total_sold DESC) AS rank_index,
    (SELECT COUNT(*) FROM public.names) AS total_count
  FROM eladas_statisztika
),
uj_kategoriak AS (
  -- 3. Lépés: Kiosztjuk a kategóriákat a százalékos szabályaink alapján
  SELECT 
    name,
    total_sold,
    rank_index,
    CASE 
      WHEN rank_index <= 5 THEN 'A'
      WHEN rank_index <= 5 + ROUND(0.125 * total_count) THEN 'B'
      WHEN rank_index <= 5 + ROUND(0.375 * total_count) THEN 'C'  -- 12.5% + 25% = 37.5%
      WHEN rank_index <= 5 + ROUND(0.635 * total_count) THEN 'D'  -- 37.5% + 26% = 63.5%
      ELSE 'E'
    END AS category_id
  FROM rangsorolas
)
-- 4. Lépés: Frissítjük a names táblát az új értékekkel
UPDATE public.names
SET category = uj_kategoriak.category_id
FROM uj_kategoriak
WHERE public.names.name = uj_kategoriak.name;
