CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  model_name TEXT NOT NULL,
  gpu_model TEXT NOT NULL DEFAULT 'RTX 3060',
  variant TEXT,
  memory_size_gb INTEGER,
  cooler_type TEXT,
  price_usd NUMERIC(10, 2) NOT NULL,
  stock_status TEXT NOT NULL,
  retailer TEXT NOT NULL,
  url TEXT NOT NULL,
  affiliate_url TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_memory ON products(memory_size_gb);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price_usd);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_products_retailer ON products(retailer);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON products
  FOR SELECT
  USING (true);
