import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Sales from './pages/Sales'

function App() {
  return (
    <Router>
      <nav className="navbar">
        <h1>Retail Forecasting & Inventory Optimizer</h1>
        <ul>
          <li><a href="/">Dashboard</a></li>
          <li><a href="/products">Products</a></li>
          <li><a href="/sales">Sales</a></li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/sales" element={<Sales />} />
      </Routes>
    </Router>
  )
}

export default App
