const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Store {
  id: number;
  name: string;
  status: string;
  revenue?: number;
}

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

  async importSales(file: File, store_id: string) {
    if (!store_id) {
      throw new Error('No store selected');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('store_id', store_id);

    const url = `${this.baseUrl}/api/sales/import`;
    const token = this.getToken();

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('API URL:', url);
    console.log('FormData content:', Array.from(formData.entries()));
    console.log('Authorization token:', token);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        window.location.href = '/login';
      }
      // Try to parse JSON error, fall back to text
      let parsedError: any;
      try {
        parsedError = await response.json();
      } catch (_e) {
        try {
          parsedError = await response.text();
        } catch (_e2) {
          parsedError = { detail: 'Upload failed' };
        }
      }

      const message = (parsedError && (parsedError.detail || parsedError.message))
        || (typeof parsedError === 'string' ? parsedError : `Request failed with status ${response.status}`);

      const err = new Error(message);
      // Attach parsed details for callers who want to inspect
      (err as any).details = parsedError;
      throw err;
    }

    return await response.json();
  }
  async getSales(skip = 0, limit = 100, days?: number) {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (days !== undefined) {
      params.append('days', String(days));
    }
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
    } catch (error: any) {
      console.error('API request failed:', error);
      // Network-level error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Cannot connect to server. Make sure the backend is running on ' + this.baseUrl);
      }
      // If it's not an Error instance (e.g., raw object), wrap it
      if (!(error instanceof Error)) {
        const wrapped = new Error(typeof error === 'string' ? error : JSON.stringify(error));
        (wrapped as any).details = error;
        throw wrapped;
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
  async getProducts(skip = 0, limit = 100) {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    return this.request(`/api/products/?${params.toString()}`);
  }

  async getProduct(productId: string) {
    return this.request(`/api/products/${productId}`);
  }

  async getInventory(storeId: string, skip = 0, limit = 200) {
    if (!storeId) throw new Error('storeId required');
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    return this.request(`/api/inventory/store/${storeId}?${params.toString()}`);
  }

  async getLowStock(storeId: string, skip = 0, limit = 200) {
    if (!storeId) throw new Error('storeId required');
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    return this.request(`/api/inventory/low-stock/${storeId}?${params.toString()}`);
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
  // Forecasting endpoints
  async getAvailableStores() {
    return this.request('/api/forecasting/stores');
  }

  async getForecast(storeId: string, days: number = 7, productId: string = "") {
    return this.request('/api/forecasting/predict', {
      method: 'POST',
      body: JSON.stringify({ store_id: storeId, days, product_id: productId }),
    });
  }

  // Inventory optimization endpoints
  async getInventoryOptimization(storeId: string, leadTimeDays: number = 7, serviceLevel: number = 0.95) {
    return this.request(`/api/inventory/optimize/${storeId}?lead_time_days=${leadTimeDays}&service_level=${serviceLevel}`);
  }

  async getInventoryStores() {
    // Use stores endpoint (real stores managed by the user)
    const res = await this.request('/api/stores/me');
    // Backend returns an array of stores; normalize to { stores: [...] }
    if (Array.isArray(res)) return { stores: res };
    return { stores: res?.stores ?? [] };
  }

  // Purchase Orders endpoints
  async getSuppliers() {
    return this.request('/api/purchase-orders/suppliers');
  }

  async generatePurchaseOrder(orderData: any) {
    return this.request('/api/purchase-orders/generate', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async generatePurchaseOrderFromRecommendations(storeId: string, supplier: string, notes?: string) {
    const params = new URLSearchParams({
      store_id: storeId,
      supplier: supplier,
    });
    if (notes) params.append('notes', notes);
    
    return this.request(`/api/purchase-orders/generate-from-recommendations?${params}`, {
      method: 'POST',
    });
  }

  async generatePurchaseOrderFromForecast(storeId: string, supplier: string, notes?: string) {
    const params = new URLSearchParams({
      store_id: storeId,
      supplier: supplier,
    });
    if (notes) params.append('notes', notes);
    
    return this.request(`/api/purchase-orders/generate-from-forecast?${params}`, {
      method: 'POST',
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
   const res = await this.request('/api/stores/me');
    // Backend returns an array of stores; normalize to { stores: [...] }
    if (Array.isArray(res)) return { stores: res };
    return { stores: res?.stores ?? [] };
  }

  async getStore(storeId: string) {
    return this.request(`/api/stores/${storeId}`);
  }

  // Notifications endpoints
  async getNotifications(storeId?: string) {
    const params = storeId ? `?store_id=${storeId}` : '';
    return this.request(`/api/notifications${params}`);
  }

  async markNotificationRead(notificationId: string) {
    return this.request(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead(storeId?: string) {
    const params = storeId ? `?store_id=${storeId}` : '';
    return this.request(`/api/notifications/read-all${params}`, {
      method: 'POST',
    });
  }

  // Holidays endpoints
  async getHolidays(market?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (market) params.append('market', market);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/holidays/${queryString}`);
  }

  async getHoliday(holidayId: string) {
    return this.request(`/api/holidays/${holidayId}`);
  }

  async createHoliday(holiday: any) {
    return this.request('/api/holidays/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holiday),
    });
  }

  async updateHoliday(holidayId: string, holiday: any) {
    return this.request(`/api/holidays/${holidayId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holiday),
    });
  }

  async deleteHoliday(holidayId: string) {
    return this.request(`/api/holidays/${holidayId}`, {
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
