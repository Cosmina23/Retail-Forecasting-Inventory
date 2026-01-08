import { useEffect, useState } from 'react'
import { getProducts } from '../api'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const skip = (page - 1) * pageSize
        const data = await getProducts(skip, pageSize)
        setProducts(data.products || [])
        setTotal(data.total || (data.products?.length || 0))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [page, pageSize])

  if (loading) return <main><div className="loading">Loading products...</div></main>
  if (error) return <main><div className="error">Error: {error}</div></main>

  return (
    <main>
      <h2>Products</h2>
      <div className="flex items-center gap-4 mb-4">
        <label>Page size:</label>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <div className="ml-auto">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Prev</button>
          <span className="mx-2">Page {page} — {total} items</span>
          <button onClick={() => setPage(page + 1)} disabled={page * pageSize >= total}>Next</button>
        </div>
      </div>
      {products.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.sku}>
                  <td>{product.sku}</td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>${product.price.toFixed(2)}</td>
                  <td>${product.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <p>No products found. Check if the database is populated.</p>
        </div>
      )}
    </main>
  )
}
