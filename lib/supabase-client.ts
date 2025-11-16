import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service role client for server-side operations that bypass RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export type Product = {
  id: string
  brand: string
  is_oc: boolean
  is_ti: boolean
  price: number
  family: string
  in_stock: boolean
  cooler_type: string
  product_title: string
  memory_size_gb: number
  special_features: string
  retailer: string
  url: string
  fetched_at: string
  created_at?: string
  updated_at?: string
}
