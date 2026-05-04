import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  User,
  LoginCredentials,
  RegisterCredentials,
  Stock,
  CreateStockRequest,
  UserStock,
  Strategy,
  UserStrategy,
  ConfigureStrategyRequest,
  Scan,
  StartScanRequest,
  ScanResult,
  StrategyStats,
  TopStock,
  PaginatedResponse,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Helper to get cookie value
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // Send cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach CSRF token
api.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const csrfToken = getCookie('csrf_token');
      if (csrfToken) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Track if we're currently refreshing to prevent infinite loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Auth endpoints that should NOT trigger token refresh
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest.url || '';

    // Don't try to refresh for auth endpoints - just reject
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => requestUrl.includes(endpoint));
    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Handle 401 - try to refresh token (but not for auth endpoints)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error);
        // Refresh failed - redirect to login (only if not already on login page)
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: async (credentials: RegisterCredentials): Promise<User> => {
    const response = await api.post<User>('/auth/register', credentials);
    return response.data;
  },

  login: async (credentials: LoginCredentials): Promise<{ message: string; user: User }> => {
    const response = await api.post<{ message: string; user: User }>('/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  refresh: async (): Promise<void> => {
    await api.post('/auth/refresh');
  },

  me: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};

// Stocks API
export const stocksApi = {
  list: async (params?: {
    limit?: number;
    offset?: number;
    active?: boolean;
    search?: string;
    sector?: string;
  }): Promise<PaginatedResponse<Stock>> => {
    const response = await api.get<PaginatedResponse<Stock>>('/stocks', { params });
    return response.data;
  },

  get: async (id: string): Promise<Stock> => {
    const response = await api.get<Stock>(`/stocks/${id}`);
    return response.data;
  },

  // Admin-only operations
  create: async (data: CreateStockRequest): Promise<Stock> => {
    const response = await api.post<Stock>('/admin/stocks', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateStockRequest>): Promise<Stock> => {
    const response = await api.put<Stock>(`/admin/stocks/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/admin/stocks/${id}`);
  },

  // Watchlist
  getWatchlist: async (params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<UserStock>> => {
    const response = await api.get<PaginatedResponse<UserStock>>('/my-stocks', { params });
    return response.data;
  },

  addToWatchlist: async (stockId: string, notes?: string): Promise<{ id: string }> => {
    const response = await api.post<{ id: string }>('/my-stocks', { stock_id: stockId, notes });
    return response.data;
  },

  removeFromWatchlist: async (stockId: string): Promise<void> => {
    await api.delete(`/my-stocks/${stockId}`);
  },
};

// Strategies API
export const strategiesApi = {
  list: async (): Promise<Strategy[]> => {
    const response = await api.get<Strategy[]>('/strategies');
    return response.data;
  },

  get: async (id: string): Promise<Strategy> => {
    const response = await api.get<Strategy>(`/strategies/${id}`);
    return response.data;
  },

  // User strategies
  listUserStrategies: async (): Promise<UserStrategy[]> => {
    const response = await api.get<UserStrategy[]>('/my-strategies');
    return response.data;
  },

  configureStrategy: async (data: ConfigureStrategyRequest): Promise<UserStrategy> => {
    const response = await api.post<UserStrategy>('/my-strategies', data);
    return response.data;
  },

  updateUserStrategy: async (id: string, data: Partial<ConfigureStrategyRequest>): Promise<UserStrategy> => {
    const response = await api.put<UserStrategy>(`/my-strategies/${id}`, data);
    return response.data;
  },

  deleteUserStrategy: async (id: string): Promise<void> => {
    await api.delete(`/my-strategies/${id}`);
  },
};

// Scans API
export const scansApi = {
  start: async (data?: StartScanRequest): Promise<{ message: string; scan: Scan }> => {
    const response = await api.post<{ message: string; scan: Scan }>('/scans', data || {});
    return response.data;
  },

  list: async (params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<PaginatedResponse<Scan>> => {
    const response = await api.get<PaginatedResponse<Scan>>('/scans', { params });
    return response.data;
  },

  get: async (id: string): Promise<Scan> => {
    const response = await api.get<Scan>(`/scans/${id}`);
    return response.data;
  },

  getStatus: async (id: string): Promise<{
    id: string;
    status: string;
    total_stocks: number;
    processed_stocks: number;
    successful_stocks: number;
    failed_stocks: number;
    execution_time_ms: number;
  }> => {
    const response = await api.get(`/scans/${id}/status`);
    return response.data;
  },

  getResults: async (
    id: string,
    params?: {
      limit?: number;
      offset?: number;
      strategy_id?: string;
      signal?: string;
      min_score?: number;
    }
  ): Promise<PaginatedResponse<ScanResult>> => {
    const response = await api.get<PaginatedResponse<ScanResult>>(`/scans/${id}/results`, { params });
    return response.data;
  },

  exportResults: async (id: string, scanName?: string): Promise<void> => {
    const response = await api.get(`/scans/${id}/export`, {
      responseType: 'blob',
    });
    
    // Create download link
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scan_results_${scanName || id.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/scans/${id}`);
  },
};

// Analytics API
export const analyticsApi = {
  getPerformance: async (days = 30): Promise<{ period_days: number; strategies: StrategyStats[] }> => {
    const response = await api.get('/analytics/performance', { params: { days } });
    return response.data;
  },

  getTopStocks: async (params?: {
    days?: number;
    limit?: number;
    strategy_id?: string;
  }): Promise<TopStock[]> => {
    const response = await api.get<TopStock[]>('/analytics/top-stocks', { params });
    return response.data;
  },
};

export default api;

