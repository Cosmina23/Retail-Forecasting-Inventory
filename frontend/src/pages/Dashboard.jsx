import { useEffect, useState } from 'react'
import { getProducts, getSalesSummary, healthCheck } from '../api'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [healthRes, summaryRes] = await Promise.all([
          healthCheck(),
          getSalesSummary(30),
        ])
        setHealth(healthRes)
        setStats(summaryRes)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <main><div className="loading">Loading dashboard...</div></main>
  if (error) return <main><div className="error">Error: {error}</div></main>

  return (
    <main>
      <h2>Dashboard</h2>
      <div className="card">
        <h3>System Health</h3>
        {health && (
          <p>
            API Status: <strong>{health.status}</strong> | Database:{' '}
            <strong>{health.database}</strong>
          </p>
        )}
      </div>
      <div className="card">
        <h3>Sales Summary (Last 30 Days)</h3>
        {stats && stats.summary ? (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Total Quantity</th>
                <th>Total Revenue</th>
                <th>Avg Price</th>
              </tr>
            </thead>
            <tbody>
              {stats.summary.map((item) => (
                <tr key={item._id}>
                  <td>{item._id}</td>
                  <td>{item.total_quantity}</td>
                  <td>${item.total_revenue.toFixed(2)}</td>
                  <td>${item.avg_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No sales data available</p>
        )}
      </div>
    </main>
  )
}
