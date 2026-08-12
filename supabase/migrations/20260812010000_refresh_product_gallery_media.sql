-- Đồng bộ một lần bộ media placeholder của sản phẩm Nutein với media mới trong public/.
-- Chỉ chạm đúng giá trị seed legacy; gallery Staff đã upload/custom sẽ được giữ nguyên.
UPDATE products
SET marketing_meta = jsonb_set(
  jsonb_set(
    jsonb_set(
      marketing_meta,
      '{image}',
      '"/media/hero-about.png"'::jsonb,
      true
    ),
    '{imageAlt}',
    '"Hộp Protein thực vật Nutein"'::jsonb,
    true
  ),
  '{gallery}',
  '[
    { "id": "gallery-1", "src": "/media/hero-about.png", "alt": "Hộp Protein thực vật Nutein — góc chính" },
    { "id": "gallery-2", "src": "/media/4 card task 2 tách/size 1_1/4-ô-khác-biẹte_01.jpg", "alt": "Protein thực vật đa nguồn Nutein", "fit": "contain" },
    { "id": "gallery-3", "src": "/media/4 card task 2 tách/size 1_1/4-ô-khác-biẹte_04.jpg", "alt": "Vitamin và khoáng chất trong Nutein", "fit": "contain" },
    { "id": "gallery-4", "src": "/media/4 card task 2 tách/size 1_1/4-ô-khác-biẹte_03.jpg", "alt": "Chất xơ hòa tan trong Nutein", "fit": "contain" }
  ]'::jsonb,
  true
)
WHERE id = 'a0000000-0000-4000-8000-000000000001'
  AND marketing_meta -> 'gallery' @> '[
    { "src": "/images/example.jpg" },
    { "src": "/images/yogurt.jpg" },
    { "src": "/images/beans.jpg" },
    { "src": "/images/vegetables.jpg" }
  ]'::jsonb;
