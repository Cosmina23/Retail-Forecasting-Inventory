const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiService {
  [x: string]: any;
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = localStorage.getItem('access_token');
  }

  // ...existing code...
  // Sales endpoints
  async getSales(skip = 0, limit = 100, days = 30) {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit), days: String(days) });
    return this.request(`/api/sales/?${params.toString()}`);
  }

  async getSalesSummary(days = 30) {
    return this.request(`/api/sales/summary?days=${days}`);
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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
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

  // Products endpoints
  async getProducts() {
    return this.request('/api/products/');
  }

  async getProduct(productId: string) {
    return this.request(`/api/products/${productId}`);
  }

  async getInventory(storeId: string, skip = 0, limit = 200) {
    if (!storeId) throw new Error('storeId required');
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    return this.request(`/api/data/inventory/store/${storeId}?${params.toString()}`);
  }

  async getLowStock(storeId: string, skip = 0, limit = 200) {
    if (!storeId) throw new Error('storeId required');
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    return this.request(`/api/data/inventory/low-stock/${storeId}?${params.toString()}`);
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

  async importProducts(file: File,store_id:string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('store_id', store_id);
      if (!store_id) {
        alert('No store selected!');
        return;
    }


    const url = `${this.baseUrl}/api/products/import`;
    const token = this.getToken();
    
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        window.location.href = '/login';
      }
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return await response.json();
  }
   // Stores endpoints
  async createStore(store: { name: string; market: string; address?: string }) {
    return this.request('/api/stores/', {
      method: 'POST',
      body: JSON.stringify(store),
    });
  }

  async getMyStores() {
    return this.request('/api/stores/me');
  }

  async getStore(storeId: string) {
    return this.request(`/api/stores/${storeId}`);
  }
}

export const apiService = new ApiService();
export default apiService;
