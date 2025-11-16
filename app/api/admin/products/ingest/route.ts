import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const FAMILIES = [
  'Ventus', 'Gaming', 'Twin Edge', 'Eagle', 'Windforce', 'Aero ITX', 'Phoenix',
  'Dual', 'TUF', 'ROG Strix', 'XLR8', 'Revel', 'Uprising', 'Epic-X', 'AMP',
  'AMP White', 'Vision', 'XC', 'XC Black', 'NB', 'BattleAx', 'iChill', 'EX',
  'EXOC', 'SG', 'Ultra', 'White Edition', 'Sakura', 'Cute Edition', 'Trio'
]

function normalizeCoolerType(coolerType: string): string {
  if (!coolerType) return ''
  const normalized = coolerType.toLowerCase()
  if (normalized === 'dual' || normalized === '2') return 'Dual'
  if (normalized === 'triple' || normalized === '3') return 'Triple'
  return coolerType
}

const EXTRACTION_PROMPT = `Extract GPU product information from the page. Return JSON with these fields:
- brand: GPU brand (NVIDIA, AMD, Intel, etc)
- model_name: Model name (RTX 3060, RTX 4070, etc)
- variant: Full product variant name
- memory_size_gb: VRAM in GB (number)
- cooler_type: Number of fans (integer, e.g., 2 or 3)
- family: Product family. Must be one of: ${FAMILIES.join(', ')}
- price_usd: Price in USD (number, remove currency symbols)
- stock_status: Either "In Stock" or "Out of Stock"
- retailer: Store name

Return ONLY valid JSON, no markdown or extra text.`

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    if (!firecrawlApiKey) {
      return NextResponse.json(
        { error: 'Firecrawl API key not configured' },
        { status: 500 }
      )
    }

    // Step 1: Call Firecrawl EXTRACT endpoint
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/extract', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        prompt: EXTRACTION_PROMPT,
        schema: {
          type: 'object',
          properties: {
            brand: { type: 'string' },
            model_name: { type: 'string' },
            variant: { type: 'string' },
            memory_size_gb: { type: 'number' },
            cooler_type: { type: 'number' },
            family: { type: 'string' },
            price_usd: { type: 'number' },
            stock_status: { type: 'string' },
            retailer: { type: 'string' },
          },
          required: ['brand', 'model_name', 'memory_size_gb', 'price_usd', 'retailer', 'stock_status'],
        },
      }),
    })

    if (!firecrawlResponse.ok) {
      const error = await firecrawlResponse.text()
      return NextResponse.json(
        { error: `Firecrawl extraction failed: ${error}` },
        { status: 500 }
      )
    }

    const firecrawlData = await firecrawlResponse.json()
    const extractedData = firecrawlData.data

    // Step 2: Validate and clean the extracted data
    const cleanedData = {
      brand: (extractedData.brand || '').trim(),
      model_name: (extractedData.model_name || '').trim(),
      gpu_model: 'RTX 3060',
      variant: (extractedData.variant || '').trim(),
      family: (extractedData.family || '').trim(),
      memory_size_gb: parseInt(extractedData.memory_size_gb) || 0,
      cooler_type: normalizeCoolerType((extractedData.cooler_type || '').toString()),
      price_usd: parseFloat(extractedData.price_usd) || 0,
      stock_status: (extractedData.stock_status || '').trim(),
      retailer: (extractedData.retailer || '').trim(),
      url,
      fetched_at: new Date().toISOString(),
    }

    // Step 3: Validate required fields
    if (!cleanedData.brand || !cleanedData.model_name || !cleanedData.retailer) {
      return NextResponse.json(
        { error: 'Missing required fields: brand, model_name, or retailer' },
        { status: 400 }
      )
    }

    // Step 4: Check for existing product (by brand, model_name, variant, retailer)
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id')
      .eq('brand', cleanedData.brand)
      .eq('model_name', cleanedData.model_name)
      .eq('variant', cleanedData.variant)
      .eq('retailer', cleanedData.retailer)

    let result
    if (existingProducts && existingProducts.length > 0) {
      // Update existing product
      result = await supabase
        .from('products')
        .update(cleanedData)
        .eq('id', existingProducts[0].id)
        .select()
    } else {
      // Insert new product
      result = await supabase
        .from('products')
        .insert([cleanedData])
        .select()
    }

    if (result.error) {
      return NextResponse.json(
        { error: `Database error: ${result.error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      product: result.data?.[0],
      message: existingProducts?.length ? 'Product updated' : 'Product created',
    })
  } catch (error) {
    console.error('Ingest error:', error)
    return NextResponse.json(
      { error: 'Failed to ingest product data' },
      { status: 500 }
    )
  }
}
