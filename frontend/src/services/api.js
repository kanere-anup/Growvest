import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

// Helpers
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Attach CSRF token for unsafe methods
    const method = (config.method || 'get').toLowerCase();
    if (["post", "put", "patch", "delete"].includes(method)) {
      const csrf = getCookie('csrf_token');
      if (csrf) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrf;
      }
    }
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.detail || error.response.data?.message || 'API Error';
      throw new Error(`${error.response.status}: ${message}`);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('Network Error: No response from server');
    } else {
      // Something else happened
      throw new Error(`Request Error: ${error.message}`);
    }
  }
);

// API endpoints
export const apiEndpoints = {
  // Health and status
  health: () => api.get('/health'),
  
  // Auth
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  
  // Strategies
  getStrategies: () => api.get('/strategies'),
  
  // Scans
  startScan: (data) => api.post('/scan', data),
  getScanStatus: (scanId) => api.get(`/scan/${scanId}/status`),
  getScanResults: (scanId, strategy) => api.get(`/scan/${scanId}/results`, { params: { strategy } }),
  getRecentScans: (limit = 10) => api.get('/scans', { params: { limit } }),
  cancelScan: (scanId) => api.delete(`/scan/${scanId}`),
  deleteScanRecords: (scanId) => api.delete(`/scan/${scanId}/records`),
  exportScan: (scanId) => api.get(`/scan/${scanId}/export`, { responseType: 'blob' }),
  
  // Analytics
  getStrategyPerformance: (days = 30) => api.get('/analytics/performance', { params: { days } }),
  getTopStocks: (days = 30, strategy = null, limit = 10) => api.get('/analytics/top-stocks', { params: { days, strategy, limit } }),
  getStockTrend: (symbol, days = 5) => api.get('/analytics/stock-trend', { params: { symbol, days } }),
  
  // Symbols
  getSymbols: () => api.get('/symbols'),

  // Stocks CRUD
  getStocks: (limit = 50, offset = 0) => api.get('/stocks', { params: { limit: Number(limit) || 50, offset: Math.max(0, Number(offset) || 0) } }),
  createStock: (payload) => api.post('/stocks', payload),
  updateStock: (id, payload) => api.put(`/stocks/${id}`, payload),
  deleteStock: (id) => api.delete(`/stocks/${id}`),
};

// Convenience functions
export const getStrategies = async () => {
  const response = await apiEndpoints.getStrategies();
  return response.data;
};

export const startScan = async (scanData = {}) => {
  const response = await apiEndpoints.startScan(scanData);
  return response.data;
};

export const getScanStatus = async (scanId) => {
  const response = await apiEndpoints.getScanStatus(scanId);
  return response.data;
};

export const getScanResults = async (scanId, strategy = null) => {
  const response = await apiEndpoints.getScanResults(scanId, strategy);
  return response.data;
};

export const getRecentScans = async (limit = 10) => {
  const response = await apiEndpoints.getRecentScans(limit);
  return response.data;
};

export const cancelScan = async (scanId) => {
  const response = await apiEndpoints.cancelScan(scanId);
  return response.data;
};

export const deleteScanRecords = async (scanId) => {
  const response = await apiEndpoints.deleteScanRecords(scanId);
  return response.data;
};

export const exportScan = async (scanId) => {
  const response = await apiEndpoints.exportScan(scanId);
  return response.data;
};

// New: helper to export and trigger a browser download with a nice filename
export const exportScanAndDownload = async (scanId) => {
  // Use the raw axios instance so we can access headers
  const response = await api.get(`/scan/${scanId}/export`, { responseType: 'blob' });
  let filename = `scan_${scanId}.xlsx`;
  const dispo = response.headers?.['content-disposition'] || response.headers?.get?.('content-disposition');
  if (dispo) {
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(dispo);
    const encoded = match && (match[1] || match[2]);
    if (encoded) {
      try {
        filename = decodeURIComponent(encoded);
      } catch {
        filename = encoded;
      }
    }
  }
  downloadFile(response.data, filename);
  return { filename };
};

export const getStrategyPerformance = async (days = 30) => {
  const response = await apiEndpoints.getStrategyPerformance(days);
  return response.data;
};

export const getTopStocks = async ({ days = 30, strategy = null, limit = 10 } = {}) => {
  const response = await apiEndpoints.getTopStocks(days, strategy, limit);
  return response.data;
};

export const getStockTrend = async (symbol, days = 5) => {
  const response = await apiEndpoints.getStockTrend(symbol, days);
  return response.data;
};

export const getSymbols = async () => {
  const response = await apiEndpoints.getSymbols();
  return response.data;
};

export const getStocks = async ({ limit = 50, offset = 0 } = {}) => {
  const response = await apiEndpoints.getStocks(limit, offset);
  const data = response.data;
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }
  return data;
};

export const createStock = async (payload) => {
  const response = await apiEndpoints.createStock(payload);
  return response.data;
};

export const updateStock = async (id, payload) => {
  const response = await apiEndpoints.updateStock(id, payload);
  return response.data;
};

export const deleteStock = async (id) => {
  const response = await apiEndpoints.deleteStock(id);
  return response.data;
};

// Utility functions
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
};

export const formatNumber = (value, decimals = 2) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatPercentage = (value, decimals = 2) => {
  return `${formatNumber(value, decimals)}%`;
};

// UI helpers
export const displayStrategyName = (name) => {
  if (!name) return '';
  const map = {
    avwap_proximity: 'AVWAP Proximity',
    week_52_extremes: 'Week 52 Extremes',
    volume_breakout: 'Volume Breakout',
    momentum: 'Momentum',
  };
  if (map[name]) return map[name];
  // Fallback: replace underscores and Title Case
  return name
    .split('_')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
};

export default api;
