const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client with service role
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !firecrawlApiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const logFile = fs.createWriteStream('price-update.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logFile.write(logMessage + '\n');
}

async function extractPriceFromUrl(url) {
  try {
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: [
          {
            type: 'json',
            prompt: 'Extract the product price in USD as a number. Also extract if the product is in stock (boolean). Return an object with "price" (number) and "in_stock" (boolean) properties.',
            schema: {
              type: 'object',
              properties: {
                price: {
                  type: 'number',
                  description: 'Product price in USD',
                },
                in_stock: {
                  type: 'boolean',
                  description: 'Whether the product is currently in stock',
                },
              },
              required: ['price', 'in_stock'],
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      log(`Firecrawl API error for ${url}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      log(`Firecrawl scraping failed for ${url}: ${data.error || 'Unknown error'}`);
      return null;
    }

    if (data.data && data.data.json) {
      return {
        price: data.data.json.price,
        in_stock: data.data.json.in_stock,
      };
    }

    log(`No JSON data returned from Firecrawl for ${url}`);
    return null;
  } catch (error) {
    log(`Error extracting price from ${url}: ${error.message}`);
    return null;
  }
}

async function updatePrices() {
  log('Starting daily price update job...');

  try {
    // Fetch all products from Supabase
    log('Fetching products from Supabase...');
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, url, price, in_stock, brand, product_title')
      .not('url', 'is', null);

    if (fetchError) {
      log(`Error fetching products: ${fetchError.message}`);
      return;
    }

    if (!products || products.length === 0) {
      log('No products found in database');
      return;
    }

    log(`Found ${products.length} products to update`);

    let updatedCount = 0;
    let errorCount = 0;
    let noChangeCount = 0;

    // Process each product
    for (const product of products) {
      try {
        log(`Processing: ${product.brand} ${product.product_title} (${product.url})`);

        const extractedData = await extractPriceFromUrl(product.url);

        if (!extractedData) {
          errorCount++;
          log(`  ❌ Failed to extract data`);
          continue;
        }

        const priceChanged = extractedData.price !== product.price;
        const stockChanged = extractedData.in_stock !== product.in_stock;

        if (!priceChanged && !stockChanged) {
          noChangeCount++;
          log(`  ✓ No changes (Price: $${extractedData.price}, Stock: ${extractedData.in_stock})`);
          continue;
        }

        // Update the product
        const { error: updateError } = await supabase
          .from('products')
          .update({
            price: extractedData.price,
            in_stock: extractedData.in_stock,
            fetched_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          log(`  ❌ Update failed: ${updateError.message}`);
          errorCount++;
          continue;
        }

        // Log what changed
        let changes = [];
        if (priceChanged) {
          changes.push(`Price: $${product.price} → $${extractedData.price}`);
        }
        if (stockChanged) {
          changes.push(`Stock: ${product.in_stock} → ${extractedData.in_stock}`);
        }

        log(`  ✅ Updated: ${changes.join(', ')}`);
        updatedCount++;
      } catch (error) {
        log(`  ❌ Error processing product: ${error.message}`);
        errorCount++;
      }
    }

    log('---');
    log(`Job completed: ${updatedCount} updated, ${noChangeCount} unchanged, ${errorCount} errors`);
  } catch (error) {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
  }

  logFile.end();
}

updatePrices();
