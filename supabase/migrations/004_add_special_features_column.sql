-- Add special_features column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS special_features TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_special_features ON products(special_features);
