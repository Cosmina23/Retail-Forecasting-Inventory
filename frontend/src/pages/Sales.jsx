import { useEffect, useState } from 'react'
import { getSales } from '../api'

export default function Sales() {
  const [sales, setSales] = useState([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true)
        const data = await getSales(0, 100, days)
        setSales(data.sales || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchSales()
  }, [days])

  if (loading) return <main><div className="loading">Loading sales...</div></main>
  if (error) return <main><div className="error">Error: {error}</div></main>

  return (
    <main>
      <h2>Sales History</h2>
      <div className="card">
        <label>
          Show last{' '}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
        </label>
      </div>
      {sales.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>SKU</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Revenue</th>
                <th>Promo</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale, idx) => (
                <tr key={idx}>
                  <td>{new Date(sale.date).toLocaleDateString()}</td>
                  <td>{sale.sku}</td>
                  <td>{sale.quantity}</td>
                  <td>${sale.price.toFixed(2)}</td>
                  <td>${sale.revenue.toFixed(2)}</td>
                  <td>{sale.promo ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <p>No sales data found. Check if the database is populated.</p>
        </div>
      )}
    </main>
  )
}
