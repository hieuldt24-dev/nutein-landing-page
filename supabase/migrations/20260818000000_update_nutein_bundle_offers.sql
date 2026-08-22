-- Nutein bundle pricing/offers supplied by the business team.
-- Keep the product row as the Admin source of truth so Staff can adjust these
-- fields later without a storefront code change.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'Nutein product row not found; refusing to apply bundle offers';
  END IF;
END
$$;

UPDATE products
SET
  price = 449000.00,
  marketing_meta = jsonb_set(
    jsonb_set(
      COALESCE(marketing_meta, '{}'::jsonb),
      '{defaultVariantId}',
      '"pack-1"'::jsonb,
      true
    ),
    '{variants}',
    '[
      {
        "id": "pack-1",
        "label": "1 hộp",
        "units": 1,
        "price": 449000,
        "offer": { "freeShipping": true }
      },
      {
        "id": "pack-2",
        "label": "2 hộp",
        "units": 2,
        "price": 778000,
        "offer": { "freeShipping": true, "giftDescription": "Tặng 1 bình nước", "giftUnits": 1 }
      },
      {
        "id": "pack-3",
        "label": "3 hộp",
        "units": 3,
        "price": 1167000,
        "offer": { "freeShipping": true, "giftDescription": "Tặng 1 hộp + 1 bình nước", "giftUnits": 1 }
      },
      {
        "id": "pack-5",
        "label": "5 hộp",
        "units": 5,
        "price": 1945000,
        "offer": { "freeShipping": true, "giftDescription": "Tặng 2 hộp + 1 bình nước", "giftUnits": 2 }
      }
    ]'::jsonb,
    true
  )
WHERE id = 'a0000000-0000-4000-8000-000000000001';
