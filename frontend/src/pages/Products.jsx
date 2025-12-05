import { useEffect, useState } from 'react'
import { getProducts } from '../api'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const data = await getProducts(0, 100)
        setProducts(data.products || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  if (loading) return <main><div className="loading">Loading products...</div></main>
  if (error) return <main><div className="error">Error: {error}</div></main>

  return (
    <main>
      <h2>Products</h2>
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
