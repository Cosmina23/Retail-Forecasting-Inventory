const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Store {
  id: number;
  name: string;
  status: string;
  revenue?: number;
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = localStorage.getItem('access_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
  }

  getToken() {
    return this.token || localStorage.getItem('access_token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`API Request: ${options.method || 'GET'} ${url}`);
    console.log('Base URL:', this.baseUrl);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('Token present in request');
    } else {
      console.log('No token present in request');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors', // Adaugă explicit CORS mode
      });

      console.log(`API Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        console.error('API Error:', error);
        throw new Error(error.detail || `Request failed with status ${response.status}`);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      const data = await response.json();
      console.log('API Response data:', data);
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      // Verifică dacă e network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Cannot connect to server. Make sure the backend is running on ' + this.baseUrl);
      }
      throw error;
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.access_token) {
      this.setToken(response.access_token);
    }
    return response;
  }

  async register(email: string, password: string, full_name?: string) {
    const response = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    });
    if (response.access_token) {
      this.setToken(response.access_token);
    }
    return response;
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async logout() {
    this.clearToken();
  }

  // Stores endpoints
  async getAllStores(): Promise<Store[]> {
    return this.request('/api/stores');  // ✅ Fix: add /api prefix
  }

  async getStore(storeId: string) {
    return this.request(`/api/stores/${storeId}`);
  }

  async createStore(store: any) {
    console.log('Creating store with data:', store);
    return this.request('/api/stores', {
      method: 'POST',
      body: JSON.stringify(store),
    });
  }

  async updateStore(storeId: string, store: any) {
    return this.request(`/api/stores/${storeId}`, {
      method: 'PUT',
      body: JSON.stringify(store),
    });
  }

  async deleteStore(storeId: string) {
    return this.request(`/api/stores/${storeId}`, {
      method: 'DELETE',
    });
  }

  // Products endpoints
  async getProducts() {
    return this.request('/api/products/');
  }

  async getProduct(productId: string) {
    return this.request(`/api/products/${productId}`);
  }

  async createProduct(product: any) {
    return this.request('/api/products/', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(productId: string, product: any) {
    return this.request(`/api/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  }

  async deleteProduct(productId: string) {
    return this.request(`/api/products/${productId}`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService();
export const storesApi = {
  getAllStores: () => apiService.getAllStores(),
  getStore: (storeId: string) => apiService.getStore(storeId),
  createStore: (store: any) => apiService.createStore(store),
  updateStore: (storeId: string, store: any) => apiService.updateStore(storeId, store),
  deleteStore: (storeId: string) => apiService.deleteStore(storeId),
};
export default apiService;
