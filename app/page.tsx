'use client'

import { useEffect, useState } from 'react'
import { Product } from '@/lib/supabase-client'
import './page.css'

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    brand: '',
    memory: '',
    minPrice: '',
    maxPrice: '',
    coolerType: '',
    stockStatus: '',
    retailer: '',
    sortBy: 'price_usd',
    sortOrder: 'asc',
  })

  const [filterOptions, setFilterOptions] = useState({
    brands: new Set<string>(),
    memories: new Set<number>(),
    coolerTypes: new Set<string>(),
    stockStatuses: new Set<string>(),
    retailers: new Set<string>(),
  })

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value))
      })

      const response = await fetch(`/api/products?${params.toString()}`)
      const data = await response.json()

      if (data.products) {
        setProducts(data.products)
        // Extract unique filter values
        const brands = new Set<string>()
        const memories = new Set<number>()
        const coolerTypes = new Set<string>()
        const stockStatuses = new Set<string>()
        const retailers = new Set<string>()

        data.products.forEach((product: Product) => {
          if (product.brand) brands.add(product.brand)
          if (product.memory_size_gb) memories.add(product.memory_size_gb)
          if (product.cooler_type) coolerTypes.add(product.cooler_type)
          if (product.stock_status) stockStatuses.add(product.stock_status)
          if (product.retailer) retailers.add(product.retailer)
        })

        setFilterOptions({
          brands,
          memories,
          coolerTypes,
          stockStatuses,
          retailers,
        })
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSearch = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      search: value,
    }))
  }

  const handleSort = (sortBy: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortOrder:
        prev.sortBy === sortBy
          ? prev.sortOrder === 'asc'
            ? 'desc'
            : 'asc'
          : 'asc',
    }))
  }

  const resetFilters = () => {
    setFilters({
      search: '',
      brand: '',
      memory: '',
      minPrice: '',
      maxPrice: '',
      coolerType: '',
      stockStatus: '',
      retailer: '',
      sortBy: 'price_usd',
      sortOrder: 'asc',
    })
  }

  const isInStock = (status: string) => {
    return status.toLowerCase().includes('in stock') || status.toLowerCase() === 'available'
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>RTX 3060 Deals Database</h1>
        <p>Search and filter RTX 3060 graphics cards from major retailers</p>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by brand, model, or variant..."
          value={filters.search}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="filters-container">
        <div className="filter-group">
          <label>Brand</label>
          <select
            value={filters.brand}
            onChange={(e) => handleFilterChange('brand', e.target.value)}
            className="filter-select"
          >
            <option value="">All Brands</option>
            {Array.from(filterOptions.brands)
              .sort()
              .map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Memory</label>
          <select
            value={filters.memory}
            onChange={(e) => handleFilterChange('memory', e.target.value)}
            className="filter-select"
          >
            <option value="">All Sizes</option>
            {Array.from(filterOptions.memories)
              .sort((a, b) => a - b)
              .map((memory) => (
                <option key={memory} value={memory}>
                  {memory}GB
                </option>
              ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Cooler Type</label>
          <select
            value={filters.coolerType}
            onChange={(e) => handleFilterChange('coolerType', e.target.value)}
            className="filter-select"
          >
            <option value="">All Types</option>
            {Array.from(filterOptions.coolerTypes)
              .sort()
              .map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Stock Status</label>
          <select
            value={filters.stockStatus}
            onChange={(e) => handleFilterChange('stockStatus', e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            {Array.from(filterOptions.stockStatuses)
              .sort()
              .map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Retailer</label>
          <select
            value={filters.retailer}
            onChange={(e) => handleFilterChange('retailer', e.target.value)}
            className="filter-select"
          >
            <option value="">All Retailers</option>
            {Array.from(filterOptions.retailers)
              .sort()
              .map((retailer) => (
                <option key={retailer} value={retailer}>
                  {retailer}
                </option>
              ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Price Range</label>
          <div className="price-inputs">
            <input
              type="number"
              placeholder="Min"
              value={filters.minPrice}
              onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              className="filter-input"
            />
            <span className="price-separator">-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxPrice}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              className="filter-input"
            />
          </div>
        </div>

        <button onClick={resetFilters} className="reset-button">
          Reset Filters
        </button>
      </div>

      {loading && <div className="loading-message">Loading products...</div>}

      <div className="table-container">
        <table className="products-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('brand')}>
                Brand {filters.sortBy === 'brand' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Model</th>
              <th onClick={() => handleSort('memory_size_gb')}>
                Memory {filters.sortBy === 'memory_size_gb' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('cooler_type')}>
                Cooler {filters.sortBy === 'cooler_type' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('price_usd')}>
                Price {filters.sortBy === 'price_usd' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('stock_status')}>
                Stock {filters.sortBy === 'stock_status' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Retailer</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map((product) => (
                <tr key={product.id}>
                  <td className="brand-cell">{product.brand}</td>
                  <td className="model-cell">
                    <div className="model-info">
                      <div className="model-name">{product.model_name}</div>
                      {product.variant && <div className="variant">{product.variant}</div>}
                    </div>
                  </td>
                  <td>{product.memory_size_gb}GB</td>
                  <td>{product.cooler_type}</td>
                  <td className="price-cell">${product.price_usd.toFixed(2)}</td>
                  <td>
                    <span className={`stock-badge ${isInStock(product.stock_status) ? 'in-stock' : 'out-of-stock'}`}>
                      {product.stock_status}
                    </span>
                  </td>
                  <td className="retailer-cell">{product.retailer}</td>
                  <td className="action-cell">
                    <a href={product.url} target="_blank" rel="noopener noreferrer" className="visit-button">
                      Visit
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="no-results">
                  {loading ? 'Loading...' : 'No products found. Try adjusting your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="results-summary">
        {products.length > 0 && <p>Showing {products.length} products</p>}
      </div>
    </div>
  )
}
