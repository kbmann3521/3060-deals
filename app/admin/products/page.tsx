'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminProductsPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/admin/products/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to ingest product')
        return
      }

      setMessage(`Success! ${data.message}: ${data.product?.brand} ${data.product?.model_name}`)
      setUrl('')
    } catch (err) {
      setError('Network error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin: Add Products</h1>
        <p>Add a product URL to scrape and ingest into Supabase</p>
      </div>

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label htmlFor="url">Product URL</label>
          <input
            id="url"
            type="url"
            placeholder="https://example.com/product"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="form-input"
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Ingesting...' : 'Ingest Product'}
        </button>
      </form>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  )
}
