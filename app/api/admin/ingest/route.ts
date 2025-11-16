import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/extract'
const FIRECRAWL_POLL_INTERVAL = 2000 // 2 seconds
const FIRECRAWL_POLL_TIMEOUT = 600000 // 10 minutes

interface ExtractedProduct {
  brand: string
  is_oc: boolean
  price: number
  family: string
  in_stock: boolean
  cooler_type: string
  product_title: string
  memory_size_gb: number
  special_features: string
}

interface FirecrawlJobSubmission {
  success: boolean
  id: string
}

interface FirecrawlJobStatus {
  success: boolean
  status: 'processing' | 'completed' | 'failed' | 'cancelled'
  data?: ExtractedProduct | ExtractedProduct[]
  expiresAt?: string
}

function mapFirecrawlToProduct(extracted: ExtractedProduct, url: string) {
  // Map directly to Firecrawl schema field names for consistency
  return {
    brand: extracted.brand,
    is_oc: extracted.is_oc,
    price: extracted.price,
    family: extracted.family,
    in_stock: extracted.in_stock,
    cooler_type: normalizeCoolerType(extracted.cooler_type),
    product_title: extracted.product_title,
    memory_size_gb: extracted.memory_size_gb,
    special_features: extracted.special_features,
    retailer: new URL(url).hostname?.replace('www.', '') || 'unknown',
    url: url,
    fetched_at: new Date().toISOString(),
  }
}

function normalizeCoolerType(coolerType: string): string {
  if (!coolerType) return ''
  const normalized = coolerType.toLowerCase()
  if (normalized === 'dual') return 'Dual'
  if (normalized === 'triple') return 'Triple'
  return coolerType
}

async function waitForFirecrawlJob(jobId: string): Promise<ExtractedProduct[]> {
  const startTime = Date.now()

  while (Date.now() - startTime < FIRECRAWL_POLL_TIMEOUT) {
    const statusResponse = await fetch(`${FIRECRAWL_API_URL}/${jobId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    let status: FirecrawlJobStatus

    try {
      status = await statusResponse.json()
    } catch (parseError) {
      console.error('Failed to parse Firecrawl status response:', parseError)
      throw new Error('Invalid response from Firecrawl status endpoint')
    }

    if (!statusResponse.ok) {
      let errorMessage = `Firecrawl status check failed: ${statusResponse.status}`
      if (statusResponse.status === 402) {
        errorMessage = 'Firecrawl account ran out of credits during processing'
      }
      console.error('Firecrawl status error:', errorMessage)
      throw new Error(errorMessage)
    }

    if (status.status === 'completed') {
      if (!status.data) {
        throw new Error('Job completed but no data returned')
      }

      // Handle both single object and array responses
      const dataArray = Array.isArray(status.data) ? status.data : [status.data]
      return dataArray
    }

    if (status.status === 'failed') {
      throw new Error('Firecrawl extraction job failed')
    }

    if (status.status === 'cancelled') {
      throw new Error('Firecrawl extraction job was cancelled')
    }

    // Still processing, wait before polling again
    await new Promise(resolve => setTimeout(resolve, FIRECRAWL_POLL_INTERVAL))
  }

  throw new Error('Firecrawl job timed out after 5 minutes')
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

    // Check for existing URLs in the database
    console.log('Checking for duplicate URLs in database...')
    const { data: existingProducts, error: queryError } = await supabaseAdmin
      .from('products')
      .select('url')
      .in('url', urls)

    if (queryError) {
      console.error('Error checking for existing URLs:', queryError)
      return NextResponse.json(
        {
          success: false,
          message: `Database error while checking for duplicates: ${queryError.message}`,
        },
        { status: 500 }
      )
    }

    const existingUrls = new Set((existingProducts || []).map((p) => p.url))
    const duplicateUrls = urls.filter((url) => existingUrls.has(url))
    const newUrls = urls.filter((url) => !existingUrls.has(url))

    // Return early if all URLs are duplicates
    if (newUrls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: `All ${urls.length} URL(s) already exist in the database`,
          duplicateCount: duplicateUrls.length,
          duplicateUrls,
          productsAdded: 0,
        },
        { status: 400 }
      )
    }

    // Log duplicate detection
    if (duplicateUrls.length > 0) {
      console.log(
        `Found ${duplicateUrls.length} duplicate URL(s), processing ${newUrls.length} new URL(s)`
      )
    }

    // Submit extraction job to Firecrawl for new URLs only
    console.log('Submitting extraction job for URLs:', newUrls)

    const submitResponse = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: newUrls,
        prompt: 'cooler_type is the number of fans ("dual" or "tripple"). family options include: Ventus, Gaming, Twin Edge, Eagle, Windforce, Aero ITX, Phoenix, TUF, ROG Strix, XLR8, Revel, Uprising, Epic-X, AMP, AMP White, Vision, XC, XC Black, NB, BattleAx, iChill, EX, EXOC, SG, Ultra, White Edition, Sakura, Cute Edition. If no family is found, use "Base" as the family. special_features include: IceStorm, IceStorm 2.0, FireStorm Software, FREEZE Fan Stop, Active Fan Control, Axial-Tech Fans, 0dB Technology, MaxContact, AURA Sync RGB, Dual BIOS, Torx Fan 3.0, Torx Fan 4.0, Twin Frozr, Zero Frozr, TRI FROZR 2, Core Pipe, Mystic Light RGB, Windforce Cooling, Alternate Spinning, 3D Active Fan, Screen Cooling, RGB Fusion, EPIC-X RGB, iGame Center, FrostBlade Fans. If no special features found, use None',
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
              enum: ['Dual', 'Triple'],
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
            special_features: {
              type: 'string',
              description: 'Special cooling or technology features',
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

    let jobData: FirecrawlJobSubmission

    try {
      jobData = await submitResponse.json()
    } catch (parseError) {
      console.error('Failed to parse Firecrawl submission response:', parseError)
      return NextResponse.json(
        { success: false, message: 'Failed to parse Firecrawl response' },
        { status: 500 }
      )
    }

    if (!submitResponse.ok) {
      let errorMessage = `Firecrawl API returned ${submitResponse.status}`

      if (submitResponse.status === 402) {
        errorMessage = 'Firecrawl account has insufficient credits. Please check your Firecrawl API key and account balance.'
      } else if (submitResponse.status === 401) {
        errorMessage = 'Firecrawl API key is invalid or expired.'
      } else {
        errorMessage = `Firecrawl error: ${submitResponse.status}`
      }

      console.error('Firecrawl submission error:', errorMessage)

      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
        },
        { status: submitResponse.status }
      )
    }

    if (!jobData.success || !jobData.id) {
      console.error('Firecrawl submission failed:', jobData)
      return NextResponse.json(
        {
          success: false,
          message: 'Firecrawl failed to create extraction job',
        },
        { status: 400 }
      )
    }

    console.log('Job submitted with ID:', jobData.id)

    // Wait for the job to complete
    let extractedData: ExtractedProduct[]
    try {
      extractedData = await waitForFirecrawlJob(jobData.id)
    } catch (pollError) {
      console.error('Error waiting for Firecrawl job:', pollError)
      return NextResponse.json(
        {
          success: false,
          message: `Extraction job error: ${pollError instanceof Error ? pollError.message : 'Unknown error'}`,
        },
        { status: 500 }
      )
    }

    // Process extracted data and prepare products
    const products = []
    const errors = []

    for (let i = 0; i < extractedData.length; i++) {
      try {
        const extracted = extractedData[i]
        if (!extracted || typeof extracted !== 'object') {
          errors.push('Invalid data format received from Firecrawl')
          continue
        }

        // Map extracted product to corresponding URL
        // Firecrawl returns results in the same order as input URLs
        const url = newUrls[i] || newUrls[0]
        const product = mapFirecrawlToProduct(extracted, url)
        products.push(product)
      } catch (err) {
        errors.push(
          `Error processing extracted data: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      }
    }

    // If no products were extracted, return error
    if (products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No products could be extracted from the provided URLs',
          errors,
        },
        { status: 400 }
      )
    }

    // Insert products into Supabase using service role (bypasses RLS)
    console.log('Inserting', products.length, 'products into Supabase')

    const { error: insertError } = await supabaseAdmin
      .from('products')
      .insert(products)
      .select()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        {
          success: false,
          message: `Database error: ${insertError.message}`,
          errors: [insertError.message, ...errors],
        },
        { status: 500 }
      )
    }

    console.log('Successfully inserted', products.length, 'products')

    const response: any = {
      success: true,
      message: `Successfully added ${products.length} product(s) to the database`,
      productsAdded: products.length,
    }

    // Include duplicate information if there were any
    if (duplicateUrls.length > 0) {
      response.message += ` (${duplicateUrls.length} duplicate URL(s) were skipped)`
      response.duplicateCount = duplicateUrls.length
      response.duplicateUrls = duplicateUrls
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    return NextResponse.json(response)
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
