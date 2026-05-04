// User types
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_verified: boolean;
  created_at: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  full_name?: string;
}

// Stock types
export interface Stock {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  market_cap: number;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateStockRequest {
  symbol: string;
  exchange?: string;
  name?: string;
  sector?: string;
  market_cap?: number;
  is_active?: boolean;
}

export interface UserStock {
  id: string;
  stock: Stock;
  notes: string;
  is_favorite: boolean;
  created_at: string;
}

// Strategy types
export interface Strategy {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>;
  is_system: boolean;
  is_active: boolean;
}

export interface UserStrategy {
  id: string;
  strategy_id: string;
  custom_name: string;
  parameters: Record<string, unknown>;
  is_enabled: boolean;
  priority: number;
  strategy: Strategy;
  created_at: string;
  updated_at: string;
}

export interface ConfigureStrategyRequest {
  strategy_id: string;
  custom_name?: string;
  parameters?: Record<string, unknown>;
  is_enabled?: boolean;
  priority?: number;
}

// Scan types
export interface Scan {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_stocks: number;
  processed_stocks: number;
  successful_stocks: number;
  failed_stocks: number;
  results_count: number;
  execution_time_ms: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface StartScanRequest {
  name?: string;
  strategy_ids?: string[];
  stock_ids?: string[];
}

export interface ScanResult {
  id: string;
  symbol: string;
  current_price: number;
  score: number;
  signal: 'buy' | 'sell' | 'hold' | 'neutral';
  result_data: Record<string, unknown>;
  strategy: Strategy;
  created_at: string;
}

// Analytics types
export interface StrategyStats {
  strategy_name: string;
  strategy_display_name: string;
  total_results: number;
  unique_stocks: number;
  avg_score: number;
}

export interface TopStock {
  symbol: string;
  hits: number;
  avg_score: number;
  last_seen: string;
}

// API response types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: string;
  message: string;
}

