import { supabase } from '@/lib/supabase-client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Get search and filter parameters
    const search = searchParams.get('search') || ''
    const brand = searchParams.get('brand') || ''
    const memory_size_gb = searchParams.get('memory_size_gb') || ''
    const cooler_type = searchParams.get('cooler_type') || ''
    const is_oc = searchParams.get('is_oc') || ''
    const is_ti = searchParams.get('is_ti') || ''
    const family = searchParams.get('family') || ''
    const special_features = searchParams.get('special_features') || ''
    const sortBy = searchParams.get('sortBy') || 'price'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    let query = supabase.from('products').select('*')

    // Apply search filter
    if (search) {
      query = query.or(
        `brand.ilike.%${search}%,product_title.ilike.%${search}%,family.ilike.%${search}%`
      )
    }

    // Apply exact filters
    if (brand) query = query.eq('brand', brand)
    if (memory_size_gb) query = query.eq('memory_size_gb', parseInt(memory_size_gb))
    if (cooler_type) query = query.eq('cooler_type', cooler_type)
    if (family) query = query.eq('family', family)
    if (is_oc) query = query.eq('is_oc', is_oc === 'true')
    if (is_ti) query = query.eq('is_ti', is_ti === 'true')
    if (special_features) query = query.ilike('special_features', `%${special_features}%`)

    // Apply sorting
    const order = sortOrder === 'desc'
    query = query.order(sortBy, { ascending: !order })

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ products: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
