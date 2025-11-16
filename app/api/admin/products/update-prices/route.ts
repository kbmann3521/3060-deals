import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const SCRAPE_PROMPT = `Extract current GPU product pricing and stock status. Return JSON with:
- price_usd: Current price in USD (number only)
- stock_status: "In Stock" or "Out of Stock"

Return ONLY valid JSON, no markdown.`

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.ADMIN_SECRET_TOKEN

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!firecrawlApiKey) {
      return NextResponse.json(
        { error: 'Firecrawl API key not configured' },
        { status: 500 }
      )
    }

    // Fetch all products with URLs
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, url, price_usd, stock_status')

    if (fetchError) {
      return NextResponse.json(
        { error: `Database error: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: 'No products to update',
      })
    }

    const updates = []
    const errors = []

    // Update each product's price and stock status
    for (const product of products) {
      try {
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: product.url,
            extractWithLLM: true,
            prompt: SCRAPE_PROMPT,
          }),
        })

        if (!firecrawlResponse.ok) {
          errors.push({ url: product.url, error: 'Firecrawl scrape failed' })
          continue
        }

        const firecrawlData = await firecrawlResponse.json()
        const scrapedData = firecrawlData.llmExtract || firecrawlData.data

        const newPrice = parseFloat(scrapedData.price_usd)
        const newStockStatus = scrapedData.stock_status?.trim() || product.stock_status

        // Only update if values changed
        if (newPrice !== product.price_usd || newStockStatus !== product.stock_status) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              price_usd: newPrice,
              stock_status: newStockStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', product.id)

          if (updateError) {
            errors.push({ id: product.id, error: updateError.message })
          } else {
            updates.push(product.id)
          }
        }
      } catch (error) {
        errors.push({ url: product.url, error: String(error) })
      }
    }

    return NextResponse.json({
      success: true,
      updated: updates.length,
      total: products.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${updates.length} of ${products.length} products`,
    })
  } catch (error) {
    console.error('Update prices error:', error)
    return NextResponse.json(
      { error: 'Failed to update prices' },
      { status: 500 }
    )
  }
}
