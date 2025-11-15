import { supabase } from '@/lib/supabase-client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Get search and filter parameters
    const search = searchParams.get('search') || ''
    const brand = searchParams.get('brand') || ''
    const memory = searchParams.get('memory') || ''
    const minPrice = searchParams.get('minPrice') || ''
    const maxPrice = searchParams.get('maxPrice') || ''
    const coolerType = searchParams.get('coolerType') || ''
    const stockStatus = searchParams.get('stockStatus') || ''
    const retailer = searchParams.get('retailer') || ''
    const sortBy = searchParams.get('sortBy') || 'price_usd'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    let query = supabase.from('products').select('*')

    // Apply search filter
    if (search) {
      query = query.or(
        `brand.ilike.%${search}%,model_name.ilike.%${search}%,variant.ilike.%${search}%`
      )
    }

    // Apply exact filters
    if (brand) query = query.eq('brand', brand)
    if (memory) query = query.eq('memory_size_gb', parseInt(memory))
    if (coolerType) query = query.eq('cooler_type', coolerType)
    if (stockStatus) query = query.eq('stock_status', stockStatus)
    if (retailer) query = query.eq('retailer', retailer)

    // Apply price range
    if (minPrice) query = query.gte('price_usd', parseFloat(minPrice))
    if (maxPrice) query = query.lte('price_usd', parseFloat(maxPrice))

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
