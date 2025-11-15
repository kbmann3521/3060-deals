-- First, delete duplicate products keeping only the most recent one per URL
DELETE FROM products
WHERE id NOT IN (
  SELECT id
  FROM (
    SELECT DISTINCT ON (url) id
    FROM products
    WHERE url IS NOT NULL
    ORDER BY url, fetched_at DESC
  ) AS latest_products
)
AND url IS NOT NULL;

-- Add unique constraint on URL to prevent future duplicates
ALTER TABLE products
ADD CONSTRAINT products_url_unique UNIQUE(url);

-- Create index for faster URL lookups during duplicate checks
CREATE INDEX IF NOT EXISTS idx_products_url ON products(url);
