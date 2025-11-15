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
    memory_size_gb: '',
    cooler_type: '',
    is_oc: '',
    family: '',
    sortBy: 'price',
    sortOrder: 'asc',
  })

  const [filterOptions, setFilterOptions] = useState({
    brands: new Set<string>(),
    memories: new Set<number>(),
    coolerTypes: new Set<string>(),
    families: new Set<string>(),
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
        const families = new Set<string>()

        data.products.forEach((product: Product) => {
          if (product.brand) brands.add(product.brand)
          if (product.memory_size_gb) memories.add(product.memory_size_gb)
          if (product.cooler_type) coolerTypes.add(product.cooler_type)
          if (product.family) families.add(product.family)
        })

        setFilterOptions({
          brands,
          memories,
          coolerTypes,
          families,
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
      memory_size_gb: '',
      cooler_type: '',
      is_oc: '',
      family: '',
      sortBy: 'price',
      sortOrder: 'asc',
    })
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
          placeholder="Search by brand, product title, or family..."
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
            value={filters.memory_size_gb}
            onChange={(e) => handleFilterChange('memory_size_gb', e.target.value)}
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
            value={filters.cooler_type}
            onChange={(e) => handleFilterChange('cooler_type', e.target.value)}
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
          <label>Overclock</label>
          <select
            value={filters.is_oc}
            onChange={(e) => handleFilterChange('is_oc', e.target.value)}
            className="filter-select"
          >
            <option value="">All</option>
            <option value="true">Overclocked</option>
            <option value="false">Stock</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Family</label>
          <select
            value={filters.family}
            onChange={(e) => handleFilterChange('family', e.target.value)}
            className="filter-select"
          >
            <option value="">All Families</option>
            {Array.from(filterOptions.families)
              .sort()
              .map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
          </select>
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
              <th>Title</th>
              <th onClick={() => handleSort('memory_size_gb')}>
                Memory {filters.sortBy === 'memory_size_gb' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('cooler_type')}>
                Cooler {filters.sortBy === 'cooler_type' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('is_oc')}>
                OC {filters.sortBy === 'is_oc' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('price')}>
                Price {filters.sortBy === 'price' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Stock</th>
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
                      <div className="model-name">{product.product_title}</div>
                      {product.family && <div className="variant">{product.family}</div>}
                    </div>
                  </td>
                  <td>{product.memory_size_gb}GB</td>
                  <td>{product.cooler_type}</td>
                  <td>{product.is_oc ? 'Yes' : 'No'}</td>
                  <td className="price-cell">${product.price.toFixed(2)}</td>
                  <td>
                    <span className={`stock-badge ${product.in_stock ? 'in-stock' : 'out-of-stock'}`}>
                      {product.in_stock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
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
