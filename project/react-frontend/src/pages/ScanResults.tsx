import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { scansApi, strategiesApi } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTheme } from '@/context/ThemeContext';
import { 
  ArrowLeft, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Filter,
  Download,
  Clock,
  CheckCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { formatCurrency, formatNumber, formatDateTime, formatDuration, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { ScanResult } from '@/types';

export function ScanResults() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Fetch scan details
  const { data: scan, isLoading: scanLoading } = useQuery({
    queryKey: ['scan', id],
    queryFn: () => scansApi.get(id!),
    enabled: !!id,
  });

  // Fetch scan results
  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['scan-results', id, { limit: pageSize, offset: page * pageSize, strategy_id: selectedStrategy || undefined }],
    queryFn: () =>
      scansApi.getResults(id!, {
        limit: pageSize,
        offset: page * pageSize,
        strategy_id: selectedStrategy || undefined,
      }),
    enabled: !!id,
  });

  // Fetch strategies for filter
  const { data: strategies } = useQuery({
    queryKey: ['strategies'],
    queryFn: strategiesApi.list,
  });

  const handleExport = async () => {
    try {
      await scansApi.exportResults(id!, scan?.name);
      toast.success('Export downloaded successfully');
    } catch {
      toast.error('Failed to export results');
    }
  };

  const isLoading = scanLoading || resultsLoading;
  const items = results?.items || [];
  const total = results?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <Link to="/scans">
              <button className={cn(
                "p-2.5 rounded-xl border transition-all",
                theme === 'dark'
                  ? "bg-surface-800/50 hover:bg-surface-800 border-surface-700"
                  : "bg-white hover:bg-surface-50 border-surface-200"
              )}>
                <ArrowLeft className="w-5 h-5 text-theme-secondary" />
              </button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-theme-primary">
                  {scan?.name || 'Scan Results'}
                </h1>
                {scan && (
                  <span className={cn(
                    "badge",
                    scan.status === 'completed' ? 'badge-success' : 'badge-neutral'
                  )}>
                    {scan.status}
                  </span>
                )}
              </div>
              {scan && (
                <div className="flex items-center gap-4 text-sm text-theme-secondary">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDateTime(scan.created_at)}
                  </span>
                  {scan.execution_time_ms > 0 && (
                    <span>• {formatDuration(scan.execution_time_ms)}</span>
                  )}
                </div>
              )}
            </div>
            <button onClick={handleExport} className="btn-primary">
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {scan && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  theme === 'dark' ? "bg-surface-800" : "bg-surface-100"
                )}>
                  <Activity className="w-5 h-5 text-theme-secondary" />
                </div>
                <div>
                  <p className="text-sm text-theme-secondary">Total Stocks</p>
                  <p className="text-2xl font-bold text-theme-primary">{scan.total_stocks}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl icon-wrapper-success flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success-500" />
                </div>
                <div>
                  <p className="text-sm text-theme-secondary">Successful</p>
                  <p className="text-2xl font-bold text-success-500">{scan.successful_stocks}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl icon-wrapper-danger flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-danger-500" />
                </div>
                <div>
                  <p className="text-sm text-theme-secondary">Failed</p>
                  <p className="text-2xl font-bold text-danger-500">{scan.failed_stocks}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl icon-wrapper-primary flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <p className="text-sm text-theme-secondary">Results Found</p>
                  <p className="text-2xl font-bold text-primary-500">{total}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="card p-4 animate-slide-up animate-delay-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-theme-tertiary" />
              <span className="text-sm font-medium text-theme-secondary">Filter by:</span>
            </div>
            <select
              value={selectedStrategy}
              onChange={(e) => {
                setSelectedStrategy(e.target.value);
                setPage(0);
              }}
              className="select w-full sm:w-64"
            >
              <option value="">All Strategies</option>
              {strategies?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
            <div className="ml-auto text-sm text-theme-secondary">
              {total} results found
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3 animate-slide-up animate-delay-200">
          {isLoading ? (
            <div className="card p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="card p-12 text-center">
              <div className={cn(
                "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center",
                theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
              )}>
                <TrendingUp className="w-8 h-8 text-theme-tertiary" />
              </div>
              <h3 className="text-lg font-semibold text-theme-primary mb-2">No results found</h3>
              <p className="text-theme-secondary">Try adjusting your filters or run a new scan</p>
            </div>
          ) : (
            items.map((result, index) => (
              <ResultCard key={result.id} result={result} index={index} theme={theme} />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
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
      </div>
    </MainLayout>
  );
}

// Result Card Component
function ResultCard({ result, index, theme }: { result: ScanResult; index: number; theme: 'light' | 'dark' }) {
  const [expanded, setExpanded] = useState(false);

  const getSignalConfig = (signal: string) => {
    switch (signal) {
      case 'buy':
        return { icon: <TrendingUp className="w-4 h-4" />, class: 'badge-success', text: 'BUY' };
      case 'sell':
        return { icon: <TrendingDown className="w-4 h-4" />, class: 'badge-danger', text: 'SELL' };
      default:
        return { icon: <Minus className="w-4 h-4" />, class: 'badge-neutral', text: signal.toUpperCase() };
    }
  };

  const signalConfig = getSignalConfig(result.signal);

  return (
    <div 
      className="card-hover overflow-hidden animate-slide-up"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div 
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              result.signal === 'buy' ? 'icon-wrapper-success' : 
              result.signal === 'sell' ? 'icon-wrapper-danger' : 
              theme === 'dark' ? 'bg-surface-800' : 'bg-surface-100'
            )}>
              <span className={cn(
                result.signal === 'buy' ? 'text-success-500' : 
                result.signal === 'sell' ? 'text-danger-500' : 'text-theme-tertiary'
              )}>
                {signalConfig.icon}
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-mono text-lg font-bold text-theme-primary">{result.symbol}</h3>
                <span className={signalConfig.class}>
                  {signalConfig.text}
                </span>
              </div>
              <p className="text-sm text-theme-secondary">{result.strategy.display_name}</p>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-8">
            <div className="text-right hidden sm:block">
              <p className="text-lg font-bold text-theme-primary">{formatCurrency(result.current_price)}</p>
              <p className="text-xs text-theme-tertiary">Current Price</p>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <div className="progress w-20">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      result.score >= 70 ? "bg-success-500" :
                      result.score >= 40 ? "bg-warning-500" : "bg-danger-500"
                    )}
                    style={{ width: `${Math.min(result.score, 100)}%` }}
                  />
                </div>
                <span className="font-bold text-theme-primary">{formatNumber(result.score, 1)}</span>
              </div>
              <p className="text-xs text-theme-tertiary">Score</p>
            </div>

            <button className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-surface-800/50" : "hover:bg-surface-100"
            )}>
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-theme-secondary" />
              ) : (
                <ChevronDown className="w-5 h-5 text-theme-secondary" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className={cn(
          "px-5 pb-5 pt-0 border-t animate-slide-down",
          theme === 'dark' ? "border-surface-800" : "border-surface-200"
        )}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {Object.entries(result.result_data).map(([key, value]) => (
              <div key={key} className={cn(
                "rounded-lg p-3",
                theme === 'dark' ? "bg-surface-800/30" : "bg-surface-50"
              )}>
                <span className="text-xs text-theme-tertiary uppercase tracking-wider block mb-1">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="font-mono text-sm font-medium text-theme-primary">
                  {typeof value === 'number' ? formatNumber(value, 2) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
