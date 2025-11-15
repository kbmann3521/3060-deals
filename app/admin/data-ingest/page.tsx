'use client'

import { useState } from 'react'
import './page.css'

interface IngestResult {
  success: boolean
  message: string
  productsAdded?: number
  errors?: string[]
}

export default function DataIngestPage() {
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const urlList = urls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0)

      if (urlList.length === 0) {
        setError('Please enter at least one URL')
        setLoading(false)
        return
      }

      const response = await fetch('/api/admin/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls: urlList }),
        // Increase timeout to 10 minutes for long-running Firecrawl jobs
        signal: AbortSignal.timeout(600000),
      })

      const data: IngestResult = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to ingest data')
        setResult(null)
      } else {
        setResult(data)
        setUrls('')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out after 10 minutes. Firecrawl may still be processing.')
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ingest-container">
      <div className="ingest-header">
        <h1>Data Ingestion</h1>
        <p>Enter URLs to extract and analyze product data using Firecrawl</p>
      </div>

      <div className="ingest-content">
        <form onSubmit={handleSubmit} className="ingest-form">
          <div className="form-group">
            <label htmlFor="urls">Product URLs</label>
            <textarea
              id="urls"
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="Enter one URL per line..."
              className="ingest-textarea"
              disabled={loading}
              rows={8}
            />
            <p className="form-hint">Paste one product URL per line. Firecrawl will extract product information including brand, price, memory, cooler type, and stock status.</p>
          </div>

          <button
            type="submit"
            className="ingest-button"
            disabled={loading || urls.trim().length === 0}
          >
            {loading ? 'Processing...' : 'Ingest Data'}
          </button>
        </form>

        <div className="ingest-results">
          {error && (
            <div className="result-box error">
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          )}

          {result && result.success && (
            <div className="result-box success">
              <h3>Success!</h3>
              <p>{result.message}</p>
              {result.productsAdded && (
                <p className="result-stat">
                  <strong>{result.productsAdded}</strong> product(s) added to database
                </p>
              )}
            </div>
          )}

          {result && !result.success && (
            <div className="result-box warning">
              <h3>Partial Success</h3>
              <p>{result.message}</p>
              {result.errors && result.errors.length > 0 && (
                <div className="errors-list">
                  <p className="errors-label">Errors:</p>
                  <ul>
                    {result.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
