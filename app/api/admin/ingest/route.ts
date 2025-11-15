import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/extract'

interface ExtractedProduct {
  brand: string
  is_oc: boolean
  price: number
  family: string
  in_stock: boolean
  cooler_type: string
  product_title: string
  memory_size_gb: number
}

interface FirecrawlResponse {
  success: boolean
  data: {
    results: Array<{
      url: string
      markdown?: string
      json?: ExtractedProduct
      extract?: ExtractedProduct
    }>
  }
}

function mapFirecrawlToProduct(extracted: ExtractedProduct, url: string) {
  return {
    brand: extracted.brand,
    model_name: extracted.product_title,
    gpu_model: 'RTX 3060',
    variant: extracted.family,
    memory_size_gb: extracted.memory_size_gb,
    cooler_type: extracted.cooler_type,
    price_usd: extracted.price,
    stock_status: extracted.in_stock ? 'in_stock' : 'out_of_stock',
    retailer: new URL(url).hostname?.replace('www.', '') || 'unknown',
    url: url,
    affiliate_url: null,
    fetched_at: new Date().toISOString(),
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { success: false, message: 'Firecrawl API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { urls } = body

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No URLs provided' },
        { status: 400 }
      )
    }

    // Call Firecrawl EXTRACT endpoint
    const firecrawlResponse = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: urls,
        prompt: 'cooler_type is the number of fans ("dual" or "triple"). family options include: Ventus, Gaming, Twin Edge, Eagle, Windforce, Aero ITX, Phoenix, Dual, TUF, ROG Strix, XLR8, Revel, Uprising, Epic-X, AMP, AMP White, Vision, XC, XC Black, NB, BattleAx, iChill, EX, EXOC, SG, Ultra, White Edition, Sakura, Cute Edition, Trio',
        schema: {
          type: 'object',
          properties: {
            brand: {
              type: 'string',
              description: 'GPU brand (e.g., NVIDIA, GIGABYTE, MSI, ASUS)',
            },
            is_oc: {
              type: 'boolean',
              description: 'Whether the card is overclocked',
            },
            price: {
              type: 'number',
              description: 'Price in USD',
            },
            family: {
              type: 'string',
              description: 'GPU family/model line',
            },
            in_stock: {
              type: 'boolean',
              description: 'Whether the product is in stock',
            },
            cooler_type: {
              type: 'string',
              enum: ['dual', 'triple'],
              description: 'Number of fans: dual or triple',
            },
            product_title: {
              type: 'string',
              description: 'Full product title/name',
            },
            memory_size_gb: {
              type: 'number',
              description: 'GPU memory in GB',
            },
          },
          required: [
            'brand',
            'price',
            'product_title',
            'memory_size_gb',
            'cooler_type',
          ],
        },
        enableWebSearch: false,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
          skipTlsVerification: true,
          blockAds: true,
        },
        ignoreInvalidURLs: true,
      }),
    })

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text()
      console.error('Firecrawl error response:', errorText)
      return NextResponse.json(
        {
          success: false,
          message: `Firecrawl API error: ${firecrawlResponse.status}`,
        },
        { status: firecrawlResponse.status }
      )
    }

    let firecrawlData: FirecrawlResponse
    try {
      firecrawlData = await firecrawlResponse.json()
    } catch (parseError) {
      console.error('Failed to parse Firecrawl response:', parseError)
      return NextResponse.json(
        { success: false, message: 'Failed to parse Firecrawl response' },
        { status: 500 }
      )
    }

    if (!firecrawlData.success) {
      console.error('Firecrawl extraction failed:', firecrawlData)
      return NextResponse.json(
        {
          success: false,
          message: 'Firecrawl extraction failed',
          errors: ['Check that URLs are valid and accessible'],
        },
        { status: 400 }
      )
    }

    if (!firecrawlData.data?.results) {
      return NextResponse.json(
        {
          success: false,
          message: 'No results returned from Firecrawl',
        },
        { status: 400 }
      )
    }

    // Process results and insert into Supabase
    const products = []
    const errors = []

    for (const result of firecrawlData.data.results) {
      try {
        const extracted = result.extract || result.json
        if (!extracted) {
          errors.push(`No data extracted from: ${result.url}`)
          continue
        }

        const product = mapFirecrawlToProduct(extracted, result.url)
        products.push(product)
      } catch (err) {
        errors.push(
          `Error processing ${result.url}: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      }
    }

    // Insert products into Supabase
    if (products.length > 0) {
      const { error: insertError } = await supabase
        .from('products')
        .insert(products)

      if (insertError) {
        errors.push(`Database insert error: ${insertError.message}`)
        return NextResponse.json(
          {
            success: errors.length === 0,
            message:
              products.length > 0
                ? `Added ${products.length} product(s)`
                : 'Failed to add products',
            productsAdded: products.length,
            errors: errors.length > 0 ? errors : undefined,
          },
          { status: errors.length === 0 ? 200 : 207 }
        )
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      message:
        products.length > 0
          ? `Successfully added ${products.length} product(s) to the database`
          : 'No products could be extracted',
      productsAdded: products.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Data ingestion error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    )
  }
}
