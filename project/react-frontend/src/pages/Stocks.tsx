import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
  CandlestickChart,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  AlertTriangle,
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
  const [sectorFilter, setSectorFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const pageSize = 24;

  const isAdmin = user?.role === 'admin';

  // Fetch stocks
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stocks', { limit: pageSize, offset: page * pageSize, search, sector: sectorFilter, active: activeFilter }],
    queryFn: () => stocksApi.list({
      limit: pageSize,
      offset: page * pageSize,
      search: search || undefined,
      sector: sectorFilter || undefined,
      active: activeFilter === 'all' ? undefined : activeFilter === 'active',
    }),
  });

  // Fetch all stocks for sector list
  const { data: allStocksData } = useQuery({
    queryKey: ['stocks-all-sectors'],
    queryFn: () => stocksApi.list({ limit: 200, active: true }),
    staleTime: 300000,
  });

  const sectors = [...new Set((allStocksData?.items || []).map(s => s.sector).filter(Boolean))].sort();

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

  // Sync mutation (admin only) with status polling
  const [syncRunning, setSyncRunning] = useState(false);

  const pollSyncStatus = () => {
    const interval = setInterval(async () => {
      try {
        const status = await stocksApi.getSyncStatus();
        if (!status.is_running) {
          clearInterval(interval);
          setSyncRunning(false);
          toast.success('Stock sync completed! Refreshing data...');
          queryClient.invalidateQueries({ queryKey: ['stocks'] });
          queryClient.invalidateQueries({ queryKey: ['stocks-all-sectors'] });
        }
      } catch {
        // Ignore poll errors
      }
    }, 5000); // Poll every 5 seconds

    // Stop polling after 5 minutes max
    setTimeout(() => {
      clearInterval(interval);
      setSyncRunning(false);
    }, 300000);
  };

  const syncMutation = useMutation({
    mutationFn: stocksApi.syncStocks,
    onSuccess: () => {
      toast.success('Stock sync started! Fetching ~200 NSE stocks from Yahoo Finance...');
      setSyncRunning(true);
      pollSyncStatus();
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) {
        toast.error('Sync already in progress. Please wait.');
      } else if (error?.response?.status === 403) {
        toast.error('Admin access required to sync stocks');
      } else {
        const msg = error?.response?.data?.message || error?.message || 'Failed to start sync';
        toast.error(`Sync failed: ${msg}`);
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

  // Calculate stats from visible stocks
  const activeCount = stocks.filter(s => s.is_active).length;
  const inactiveCount = stocks.filter(s => !s.is_active).length;
  const delistedCount = stocks.filter(s =>
    s.metadata && (s.metadata as Record<string, unknown>)['possibly_delisted']
  ).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl icon-wrapper-primary">
              <TrendingUp className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-theme-primary">Stocks</h1>
              <p className="text-theme-secondary mt-0.5">
                {total} stocks in the universe • NSE Exchange
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                className="btn-secondary"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || syncRunning}
              >
                {syncMutation.isPending || syncRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {syncRunning ? 'Syncing...' : 'Sync NSE'}
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" />
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
                <p className="text-2xl font-bold text-success-500">{activeCount}</p>
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
                <p className="text-2xl font-bold text-theme-primary">{sectors.length}</p>
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
        </div>

        {/* Search, Filters & View Toggle */}
        <div className="card p-4 animate-slide-up animate-delay-100">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-tertiary" />
                <input
                  type="text"
                  placeholder="Search by symbol, name, or sector..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="input pl-11 w-full"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setPage(0); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-tertiary hover:text-theme-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* View Toggle */}
                <div className={cn(
                  "flex items-center rounded-xl p-1",
                  theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
                )}>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'grid'
                        ? "bg-primary-500 text-white shadow-sm"
                        : "text-theme-secondary hover:text-theme-primary"
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'list'
                        ? "bg-primary-500 text-white shadow-sm"
                        : "text-theme-secondary hover:text-theme-primary"
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-theme-tertiary" />

              {/* Status filter */}
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => { setActiveFilter(status); setPage(0); }}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize',
                    activeFilter === status
                      ? 'bg-primary-500 text-white'
                      : theme === 'dark'
                      ? 'bg-surface-800 text-theme-secondary hover:bg-surface-700'
                      : 'bg-surface-100 text-theme-secondary hover:bg-surface-200'
                  )}
                >
                  {status}
                </button>
              ))}

              <div className="w-px h-4 bg-theme-secondary/20" />

              {/* Sector filter */}
              <select
                value={sectorFilter}
                onChange={(e) => { setSectorFilter(e.target.value); setPage(0); }}
                className={cn(
                  "text-xs rounded-lg px-3 py-1.5 border transition-all cursor-pointer",
                  sectorFilter
                    ? 'bg-primary-500/10 border-primary-500/30 text-primary-500'
                    : theme === 'dark'
                    ? 'bg-surface-800 border-surface-700 text-theme-secondary'
                    : 'bg-surface-100 border-surface-200 text-theme-secondary'
                )}
              >
                <option value="">All Sectors</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>

              {(sectorFilter || activeFilter !== 'all' || search) && (
                <button
                  onClick={() => {
                    setSectorFilter('');
                    setActiveFilter('all');
                    setSearch('');
                    setPage(0);
                  }}
                  className="text-xs text-primary-500 hover:text-primary-400 font-medium"
                >
                  Clear all
                </button>
              )}

              <span className="ml-auto text-xs text-theme-tertiary">
                {total} result{total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Stocks Display */}
        <div className="animate-slide-up animate-delay-200">
          {isLoading ? (
            <div className="card p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              <p className="text-theme-secondary text-sm">Loading stocks...</p>
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
                {search ? 'Try adjusting your search or filters' : 'Add stocks to get started'}
              </p>
              {isAdmin && !search && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="btn-primary"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                  >
                    <Download className="w-4 h-4" />
                    Sync from NSE
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setEditingStock(null);
                      setShowModal(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Manually
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            // Grid View
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                      <th>Sector</th>
                      <th className="text-right">Market Cap</th>
                      <th className="text-right">Last Price</th>
                      <th>Status</th>
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map((stock, index) => {
                      const meta = (stock.metadata || {}) as Record<string, unknown>;
                      const lastPrice = meta['last_price'] as number | undefined;
                      const isDelisted = meta['possibly_delisted'] as boolean | undefined;

                      return (
                        <tr
                          key={stock.id}
                          className="animate-slide-up"
                          style={{ animationDelay: `${index * 20}ms` }}
                        >
                          <td>
                            <Link to={`/chart/${stock.symbol}`} className="flex items-center gap-3 group">
                              <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-colors",
                                stock.is_active
                                  ? "bg-primary-500/10 text-primary-500 group-hover:bg-primary-500/20"
                                  : "bg-theme-tertiary text-theme-tertiary"
                              )}>
                                {stock.symbol.slice(0, 3)}
                              </div>
                              <span className="font-mono font-bold text-theme-primary group-hover:text-primary-500 transition-colors">
                                {stock.symbol}
                              </span>
                            </Link>
                          </td>
                          <td className="text-theme-secondary text-sm">{stock.name || '-'}</td>
                          <td>
                            {stock.sector ? (
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                theme === 'dark' ? "bg-surface-800 text-theme-secondary" : "bg-surface-100 text-theme-secondary"
                              )}>
                                {stock.sector}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="text-right font-mono text-sm text-theme-primary">
                            {stock.market_cap ? `₹${formatCompactNumber(stock.market_cap)}` : '-'}
                          </td>
                          <td className="text-right font-mono text-sm">
                            {lastPrice ? (
                              <span className="text-theme-primary">₹{lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            ) : '-'}
                          </td>
                          <td>
                            {isDelisted ? (
                              <span className="badge-warning flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" />
                                Delisted?
                              </span>
                            ) : (
                              <span className={stock.is_active ? 'badge-success' : 'badge-neutral'}>
                                {stock.is_active ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingStock(stock);
                                    setShowModal(true);
                                  }}
                                  className="btn-ghost p-1.5"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Delete this stock?')) {
                                      deleteMutation.mutate(stock.id);
                                    }
                                  }}
                                  className="btn-ghost p-1.5 text-danger-500 hover:bg-danger-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
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
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
            </div>
            <div className="flex items-center gap-1">
              <button
                className="btn-secondary py-2 px-3"
                onClick={() => setPage(0)}
                disabled={page === 0}
              >
                First
              </button>
              <button
                className="btn-secondary py-2 px-3"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Prev
              </button>
              <span className="px-3 py-2 text-sm text-theme-secondary">
                {page + 1} / {totalPages}
              </span>
              <button
                className="btn-secondary py-2 px-3"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </button>
              <button
                className="btn-secondary py-2 px-3"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
              >
                Last
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
  theme: string;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = (stock.metadata || {}) as Record<string, unknown>;
  const lastPrice = meta['last_price'] as number | undefined;
  const high52w = meta['52w_high'] as number | undefined;
  const low52w = meta['52w_low'] as number | undefined;
  const industry = meta['industry'] as string | undefined;
  const isDelisted = meta['possibly_delisted'] as boolean | undefined;
  const lastSynced = meta['last_synced'] as string | undefined;

  return (
    <Link
      to={`/chart/${stock.symbol}`}
      className="block"
    >
      <div
        className={cn(
          "card-hover p-4 h-full animate-slide-up group",
          isDelisted && "opacity-60",
        )}
        style={{ animationDelay: `${index * 30}ms` }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-mono text-sm font-bold transition-colors",
              stock.is_active
                ? "bg-primary-500/10 text-primary-500 group-hover:bg-primary-500/20"
                : theme === 'dark' ? "bg-surface-800 text-surface-500" : "bg-surface-200 text-surface-500"
            )}>
              {stock.symbol.slice(0, 3)}
            </div>
            <div>
              <h3 className="font-mono font-bold text-theme-primary text-sm group-hover:text-primary-500 transition-colors">
                {stock.symbol}
              </h3>
              <p className="text-xs text-theme-tertiary truncate max-w-[120px]">
                {stock.exchange}
              </p>
            </div>
          </div>
          {isDelisted ? (
            <span className="badge-warning text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Delisted?
            </span>
          ) : (
            <span className={cn("text-xs", stock.is_active ? 'badge-success' : 'badge-neutral')}>
              {stock.is_active ? 'Active' : 'Inactive'}
            </span>
          )}
        </div>

        {/* Name */}
        <p className="text-sm text-theme-secondary truncate mb-3" title={stock.name}>
          {stock.name || 'Unknown Company'}
        </p>

        {/* Price & Market Cap */}
        <div className="flex items-center justify-between mb-3">
          {lastPrice ? (
            <div>
              <p className="text-lg font-bold font-mono text-theme-primary">
                ₹{lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-theme-tertiary">No price data</p>
          )}
          {stock.market_cap ? (
            <div className="text-right">
              <p className="text-xs text-theme-tertiary">Mkt Cap</p>
              <p className="text-sm font-medium font-mono text-theme-primary">₹{formatCompactNumber(stock.market_cap)}</p>
            </div>
          ) : null}
        </div>

        {/* Sector & Industry tags */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {stock.sector && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              theme === 'dark' ? "bg-surface-800 text-theme-secondary" : "bg-surface-100 text-theme-secondary"
            )}>
              {stock.sector}
            </span>
          )}
          {industry && industry !== stock.sector && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              theme === 'dark' ? "bg-surface-800/50 text-theme-tertiary" : "bg-surface-50 text-theme-tertiary"
            )}>
              {industry}
            </span>
          )}
        </div>

        {/* 52-week range */}
        {high52w && low52w && lastPrice ? (
          <div>
            <div className="flex items-center justify-between text-xs text-theme-tertiary mb-1">
              <span>52W: ₹{low52w.toFixed(0)}</span>
              <span>₹{high52w.toFixed(0)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-surface-200 dark:bg-surface-700">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                style={{
                  left: '0%',
                  width: `${Math.min(100, Math.max(0, ((lastPrice - low52w) / (high52w - low52w)) * 100))}%`
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-primary-500 shadow-sm"
                style={{
                  left: `${Math.min(100, Math.max(0, ((lastPrice - low52w) / (high52w - low52w)) * 100))}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-[var(--border-primary)]" onClick={(e) => e.preventDefault()}>
            <button
              onClick={(e) => { e.preventDefault(); onEdit(); }}
              className="btn-secondary flex-1 py-1.5 text-xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onDelete(); }}
              className="btn-ghost p-1.5 text-danger-500 hover:bg-danger-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </Link>
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
  theme: string;
  onClose: () => void;
  onSubmit: (data: CreateStockRequest) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateStockRequest>({
    symbol: stock?.symbol || '',
    exchange: stock?.exchange || 'NSE',
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
                  className="input font-mono"
                  required
                />
              </div>
              <div>
                <label className="label">Exchange</label>
                <input
                  type="text"
                  value={formData.exchange}
                  onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                  placeholder="e.g., NSE"
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
                <p className="font-medium text-theme-primary text-sm">Active for scanning</p>
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
