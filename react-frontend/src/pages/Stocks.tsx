import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stocksApi } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  RefreshCw,
  TrendingUp,
  Building2,
  Globe,
  CircleDot,
  X,
  Check,
  AlertCircle,
  LayoutGrid,
  List,
} from 'lucide-react';
import { formatCompactNumber, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Stock, CreateStockRequest } from '@/types';

type ViewMode = 'grid' | 'list';

export function Stocks() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const pageSize = 20;

  const isAdmin = user?.role === 'admin';

  // Fetch stocks
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stocks', { limit: pageSize, offset: page * pageSize, search }],
    queryFn: () => stocksApi.list({ limit: pageSize, offset: page * pageSize, search: search || undefined }),
  });

  // Create mutation (admin only)
  const createMutation = useMutation({
    mutationFn: stocksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      toast.success('Stock created successfully');
      setShowModal(false);
    },
    onError: (error: any) => {
      if (error?.response?.status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error('Failed to create stock');
      }
    },
  });

  // Update mutation (admin only)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateStockRequest> }) =>
      stocksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      toast.success('Stock updated successfully');
      setShowModal(false);
      setEditingStock(null);
    },
    onError: (error: any) => {
      if (error?.response?.status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error('Failed to update stock');
      }
    },
  });

  // Delete mutation (admin only)
  const deleteMutation = useMutation({
    mutationFn: stocksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      toast.success('Stock deleted successfully');
    },
    onError: (error: any) => {
      if (error?.response?.status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error('Failed to delete stock');
      }
    },
  });

  const handleSubmit = (formData: CreateStockRequest) => {
    if (editingStock) {
      updateMutation.mutate({ id: editingStock.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const stocks = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const activeCount = stocks.filter(s => s.is_active).length;

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl icon-wrapper-primary">
              <TrendingUp className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-theme-primary">Stocks</h1>
              <p className="text-theme-secondary mt-0.5">
                {isAdmin ? 'Manage the stock universe' : 'View available stocks for scanning'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              className="btn-secondary"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            {isAdmin && (
              <button
                className="btn-primary"
                onClick={() => {
                  setEditingStock(null);
                  setShowModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Add Stock
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl icon-wrapper-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-theme-secondary">Total Stocks</p>
                <p className="text-2xl font-bold text-theme-primary">{total}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl icon-wrapper-success flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-success-500" />
              </div>
              <div>
                <p className="text-sm text-theme-secondary">Active</p>
                <p className="text-2xl font-bold text-theme-primary">{activeCount}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl icon-wrapper-info flex items-center justify-center">
                <Globe className="w-5 h-5 text-info-500" />
              </div>
              <div>
                <p className="text-sm text-theme-secondary">Exchange</p>
                <p className="text-2xl font-bold text-theme-primary">NSE</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl icon-wrapper-warning flex items-center justify-center">
                <Building2 className="w-5 h-5 text-warning-500" />
              </div>
              <div>
                <p className="text-sm text-theme-secondary">Sectors</p>
                <p className="text-2xl font-bold text-theme-primary">
                  {new Set(stocks.map(s => s.sector).filter(Boolean)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & View Toggle */}
        <div className="card p-4 animate-slide-up animate-delay-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-tertiary" />
              <input
                type="text"
                placeholder="Search by symbol or name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="input pl-11 w-full"
              />
            </div>
            
            {/* View Toggle */}
            <div className={cn(
              "flex items-center rounded-xl p-1",
              theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
            )}>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2.5 rounded-lg transition-all",
                  viewMode === 'grid'
                    ? "bg-primary-500 text-white shadow-sm"
                    : "text-theme-secondary hover:text-theme-primary"
                )}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2.5 rounded-lg transition-all",
                  viewMode === 'list'
                    ? "bg-primary-500 text-white shadow-sm"
                    : "text-theme-secondary hover:text-theme-primary"
                )}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            <div className="text-sm text-theme-secondary whitespace-nowrap">
              {total} stocks found
            </div>
          </div>
        </div>

        {/* Stocks Display */}
        <div className="animate-slide-up animate-delay-200">
          {isLoading ? (
            <div className="card p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : stocks.length === 0 ? (
            <div className="card p-12 text-center">
              <div className={cn(
                "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center",
                theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
              )}>
                <TrendingUp className="w-8 h-8 text-theme-tertiary" />
              </div>
              <h3 className="text-lg font-semibold text-theme-primary mb-2">No stocks found</h3>
              <p className="text-theme-secondary mb-4">
                {search ? 'Try adjusting your search' : 'Add stocks to get started'}
              </p>
              {isAdmin && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setEditingStock(null);
                    setShowModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add Stock
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            // Grid View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stocks.map((stock, index) => (
                <StockCard 
                  key={stock.id} 
                  stock={stock} 
                  index={index}
                  theme={theme}
                  isAdmin={isAdmin}
                  onEdit={() => {
                    setEditingStock(stock);
                    setShowModal(true);
                  }}
                  onDelete={() => {
                    if (confirm('Delete this stock?')) {
                      deleteMutation.mutate(stock.id);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            // List View
            <div className="card overflow-hidden">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Name</th>
                      <th>Exchange</th>
                      <th>Sector</th>
                      <th>Market Cap</th>
                      <th>Status</th>
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map((stock, index) => (
                      <tr 
                        key={stock.id}
                        className="animate-slide-up"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold",
                              stock.is_active 
                                ? "bg-primary-500/10 text-primary-500" 
                                : "bg-theme-tertiary text-theme-tertiary"
                            )}>
                              {stock.symbol.slice(0, 2)}
                            </div>
                            <span className="font-mono font-bold text-theme-primary">{stock.symbol}</span>
                          </div>
                        </td>
                        <td className="text-theme-secondary">{stock.name || '-'}</td>
                        <td className="text-theme-secondary">{stock.exchange}</td>
                        <td className="text-theme-secondary">{stock.sector || '-'}</td>
                        <td className="text-theme-primary font-medium">
                          {stock.market_cap ? `₹${formatCompactNumber(stock.market_cap)}` : '-'}
                        </td>
                        <td>
                          <span className={stock.is_active ? 'badge-success' : 'badge-neutral'}>
                            {stock.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingStock(stock);
                                  setShowModal(true);
                                }}
                                className="btn-ghost p-2"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Delete this stock?')) {
                                    deleteMutation.mutate(stock.id);
                                  }
                                }}
                                className="btn-ghost p-2 text-danger-500 hover:bg-danger-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between animate-slide-up">
            <div className="text-sm text-theme-secondary">
              Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </button>
              <button
                className="btn-secondary"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Modal (admin only) */}
        {showModal && isAdmin && (
          <StockModal
            stock={editingStock}
            theme={theme}
            onClose={() => {
              setShowModal(false);
              setEditingStock(null);
            }}
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}
      </div>
    </MainLayout>
  );
}

// Stock Card Component
function StockCard({
  stock,
  index,
  theme,
  isAdmin,
  onEdit,
  onDelete,
}: {
  stock: Stock;
  index: number;
  theme: 'light' | 'dark';
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div 
      className={cn(
        "card-hover p-5 animate-slide-up",
        stock.is_active ? "border-l-2 border-l-success-500" : "border-l-2 border-l-surface-400"
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center font-mono text-lg font-bold",
            stock.is_active 
              ? "bg-primary-500/10 text-primary-500" 
              : theme === 'dark' ? "bg-surface-800 text-surface-500" : "bg-surface-200 text-surface-500"
          )}>
            {stock.symbol.slice(0, 2)}
          </div>
          <div>
            <h3 className="font-mono font-bold text-theme-primary">{stock.symbol}</h3>
            <p className="text-sm text-theme-secondary truncate max-w-[150px]">
              {stock.name || 'Unnamed'}
            </p>
          </div>
        </div>
        <span className={stock.is_active ? 'badge-success' : 'badge-neutral'}>
          {stock.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={cn(
          "p-2.5 rounded-lg",
          theme === 'dark' ? "bg-surface-800/30" : "bg-surface-50"
        )}>
          <p className="text-xs text-theme-tertiary mb-0.5">Exchange</p>
          <p className="font-medium text-theme-primary">{stock.exchange}</p>
        </div>
        <div className={cn(
          "p-2.5 rounded-lg",
          theme === 'dark' ? "bg-surface-800/30" : "bg-surface-50"
        )}>
          <p className="text-xs text-theme-tertiary mb-0.5">Sector</p>
          <p className="font-medium text-theme-primary truncate">{stock.sector || '-'}</p>
        </div>
      </div>

      {stock.market_cap && (
        <div className={cn(
          "p-2.5 rounded-lg mb-4",
          theme === 'dark' ? "bg-surface-800/30" : "bg-surface-50"
        )}>
          <p className="text-xs text-theme-tertiary mb-0.5">Market Cap</p>
          <p className="font-semibold text-theme-primary">₹{formatCompactNumber(stock.market_cap)}</p>
        </div>
      )}

      {isAdmin && (
        <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-primary)]">
          <button
            onClick={onEdit}
            className="btn-secondary flex-1 py-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="btn-ghost p-2 text-danger-500 hover:bg-danger-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Stock Modal Component
function StockModal({
  stock,
  theme,
  onClose,
  onSubmit,
  isLoading,
}: {
  stock: Stock | null;
  theme: 'light' | 'dark';
  onClose: () => void;
  onSubmit: (data: CreateStockRequest) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateStockRequest>({
    symbol: stock?.symbol || '',
    exchange: stock?.exchange || 'NS',
    name: stock?.name || '',
    sector: stock?.sector || '',
    market_cap: stock?.market_cap || undefined,
    is_active: stock?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol.trim()) {
      setError('Symbol is required');
      return;
    }
    setError(null);
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl icon-wrapper-primary flex items-center justify-center">
              {stock ? <Edit2 className="w-5 h-5 text-primary-500" /> : <Plus className="w-5 h-5 text-primary-500" />}
            </div>
            <h2 className="text-xl font-display font-bold text-theme-primary">
              {stock ? 'Edit Stock' : 'Add Stock'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-surface-800" : "hover:bg-surface-100"
            )}
          >
            <X className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Symbol *</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  placeholder="e.g., RELIANCE"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Exchange</label>
                <input
                  type="text"
                  value={formData.exchange}
                  onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                  placeholder="e.g., NS"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Company Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Reliance Industries Ltd"
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Sector</label>
                <input
                  type="text"
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  placeholder="e.g., Energy"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Market Cap (₹)</label>
                <input
                  type="number"
                  value={formData.market_cap || ''}
                  onChange={(e) => setFormData({ ...formData, market_cap: parseFloat(e.target.value) || undefined })}
                  placeholder="e.g., 1500000000000"
                  className="input"
                />
              </div>
            </div>

            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl",
              theme === 'dark' ? "bg-surface-800/30" : "bg-surface-50"
            )}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center transition-all",
                  formData.is_active 
                    ? "bg-primary-500 text-white" 
                    : theme === 'dark'
                      ? "bg-surface-700 border-2 border-surface-600"
                      : "bg-white border-2 border-surface-300"
                )}
              >
                {formData.is_active && <Check className="w-4 h-4" />}
              </button>
              <div>
                <p className="font-medium text-theme-primary">Active for scanning</p>
                <p className="text-xs text-theme-secondary">Include this stock in scan operations</p>
              </div>
            </div>

            <div className={cn(
              "flex items-center justify-end gap-3 pt-4 border-t",
              theme === 'dark' ? "border-surface-800" : "border-surface-200"
            )}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : stock ? (
                  'Update Stock'
                ) : (
                  'Create Stock'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
