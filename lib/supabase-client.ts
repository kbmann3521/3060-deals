import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Product = {
  id: string
  brand: string
  model_name: string
  gpu_model: string
  variant: string
  family?: string
  memory_size_gb: number
  cooler_type: string
  price_usd: number
  stock_status: string
  retailer: string
  url: string
  affiliate_url: string | null
  fetched_at: string
  created_at: string
  updated_at: string
}
