import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

export const getProducts = async (skip = 0, limit = 100) => {
  const response = await api.get('/products/', { params: { skip, limit } })
  return response.data
}

export const getProductBySku = async (sku) => {
  const response = await api.get(`/products/${sku}`)
  return response.data
}

export const getProductsByCategory = async (category) => {
  const response = await api.get(`/products/category/${category}`)
  return response.data
}

export const getSales = async (skip = 0, limit = 100, days = 30) => {
  const response = await api.get('/sales/', { params: { skip, limit, days } })
  return response.data
}

export const getSalesForSku = async (sku, days = 30) => {
  const response = await api.get(`/sales/sku/${sku}`, { params: { days } })
  return response.data
}

export const getSalesSummary = async (days = 30) => {
  const response = await api.get('/sales/summary', { params: { days } })
  return response.data
}

export const healthCheck = async () => {
  const response = await api.get('/health')
  return response.data
}
