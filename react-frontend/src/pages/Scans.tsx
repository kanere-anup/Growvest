import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { scansApi, strategiesApi } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTheme } from '@/context/ThemeContext';
import { 
  Loader2, 
  PlayCircle, 
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  FileSpreadsheet,
  Scan as ScanIcon
} from 'lucide-react';
import { formatDateTime, formatDuration, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Scan } from '@/types';

export function Scans() {
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const [page, setPage] = useState(0);
  const [showNewScanModal, setShowNewScanModal] = useState(false);
  const pageSize = 10;

  // Fetch scans with auto-refresh for running scans
  const { data: scansData, isLoading } = useQuery({
    queryKey: ['scans', { limit: pageSize, offset: page * pageSize }],
    queryFn: () => scansApi.list({ limit: pageSize, offset: page * pageSize }),
    // Poll every 3 seconds if there are running/pending scans
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActiveScans = data?.items?.some(
        (scan: Scan) => scan.status === 'running' || scan.status === 'pending'
      );
      return hasActiveScans ? 3000 : false;
    },
  });

  // Fetch strategies
  const { data: strategies } = useQuery({
    queryKey: ['strategies'],
    queryFn: strategiesApi.list,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: scansApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      toast.success('Scan deleted');
    },
    onError: () => {
      toast.error('Failed to delete scan');
    },
  });

  // Start scan mutation
  const startMutation = useMutation({
    mutationFn: scansApi.start,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      toast.success('Scan started! It will run in the background.');
      setShowNewScanModal(false);
    },
    onError: () => {
      toast.error('Failed to start scan');
    },
  });

  const handleExport = async (scanId: string, scanName?: string) => {
    try {
      await scansApi.exportResults(scanId, scanName);
      toast.success('Export downloaded successfully');
    } catch {
      toast.error('Failed to export results');
    }
  };

  const scans = scansData?.items || [];
  const total = scansData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { 
          icon: <CheckCircle className="w-4 h-4" />, 
          class: 'badge-success', 
          color: 'text-success-500',
          bgColor: 'icon-wrapper-success'
        };
      case 'running':
        return { 
          icon: <Loader2 className="w-4 h-4 animate-spin" />, 
          class: 'badge-info',
          color: 'text-info-500',
          bgColor: 'icon-wrapper-info'
        };
      case 'pending':
        return { 
          icon: <Clock className="w-4 h-4" />, 
          class: 'badge-warning',
          color: 'text-warning-500',
          bgColor: 'icon-wrapper-warning'
        };
      case 'failed':
        return { 
          icon: <XCircle className="w-4 h-4" />, 
          class: 'badge-danger',
          color: 'text-danger-500',
          bgColor: 'icon-wrapper-danger'
        };
      default:
        return { 
          icon: null, 
          class: 'badge-neutral',
          color: 'text-theme-secondary',
          bgColor: theme === 'dark' ? 'bg-surface-800' : 'bg-surface-100'
        };
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl icon-wrapper-primary">
              <Zap className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-theme-primary">Scans</h1>
              <p className="text-theme-secondary mt-0.5">Run and manage your stock scans</p>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowNewScanModal(true)}
          >
            <PlayCircle className="w-4 h-4" />
            New Scan
          </button>
        </div>

        {/* Scans List */}
        {isLoading ? (
          <div className="card p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : scans.length === 0 ? (
          <div className="card p-12 text-center animate-slide-up">
            <div className={cn(
              "w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center",
              theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
            )}>
              <ScanIcon className="w-10 h-10 text-theme-tertiary" />
            </div>
            <h3 className="text-xl font-semibold text-theme-primary mb-2">No scans yet</h3>
            <p className="text-theme-secondary mb-6 max-w-md mx-auto">
              Start your first scan to discover stocks matching your strategies
            </p>
            <button
              className="btn-primary"
              onClick={() => setShowNewScanModal(true)}
            >
              <PlayCircle className="w-4 h-4" />
              Start Your First Scan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan, index) => (
              <ScanCard 
                key={scan.id} 
                scan={scan} 
                index={index}
                statusConfig={getStatusConfig(scan.status)}
                onDelete={() => {
                  if (confirm('Delete this scan?')) {
                    deleteMutation.mutate(scan.id);
                  }
                }}
                onExport={() => handleExport(scan.id, scan.name)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-theme-secondary">
              Page {page + 1} of {totalPages}
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

        {/* New Scan Modal */}
        {showNewScanModal && (
          <NewScanModal
            strategies={strategies || []}
            theme={theme}
            isLoading={startMutation.isPending}
            onClose={() => setShowNewScanModal(false)}
            onSubmit={(data) => startMutation.mutate(data)}
          />
        )}
      </div>
    </MainLayout>
  );
}

// Scan Card Component
function ScanCard({ 
  scan, 
  index, 
  statusConfig,
  onDelete, 
  onExport 
}: { 
  scan: Scan; 
  index: number;
  statusConfig: { icon: React.ReactNode; class: string; color: string; bgColor: string };
  onDelete: () => void;
  onExport: () => void;
}) {
  return (
    <div 
      className="card-hover animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Status Icon */}
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", statusConfig.bgColor)}>
            <span className={statusConfig.color}>{statusConfig.icon}</span>
          </div>

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold text-theme-primary truncate">
                {scan.name || `Scan #${scan.id.slice(0, 8)}`}
              </h3>
              <span className={statusConfig.class}>
                {scan.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-theme-secondary">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDateTime(scan.created_at)}
              </span>
              {scan.execution_time_ms > 0 && (
                <span>• {formatDuration(scan.execution_time_ms)}</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-theme-primary">{scan.total_stocks}</p>
              <p className="text-xs text-theme-tertiary">Stocks</p>
            </div>
            <div className="text-center">
              <p className={cn(
                "text-2xl font-bold",
                scan.status === 'completed' ? "text-primary-500" : "text-theme-primary"
              )}>
                {scan.results_count || 0}
              </p>
              <p className="text-xs text-theme-tertiary">Results</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {scan.status === 'completed' && (
              <>
                <Link to={`/scans/${scan.id}`}>
                  <button className="btn-primary py-2 px-4">
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </Link>
                <button
                  className="btn-secondary py-2 px-4"
                  onClick={onExport}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              className="btn-ghost p-2 text-danger-500 hover:bg-danger-500/10"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// New Scan Modal Component
function NewScanModal({
  strategies,
  theme,
  isLoading,
  onClose,
  onSubmit,
}: {
  strategies: Array<{ id: string; name: string; display_name: string }>;
  theme: 'light' | 'dark';
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; strategy_ids: string[] }) => void;
}) {
  const [name, setName] = useState(`Scan ${new Date().toLocaleDateString()}`);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStrategies.length === 0) {
      toast.error('Please select at least one strategy');
      return;
    }
    onSubmit({ name, strategy_ids: selectedStrategies });
  };

  const toggleStrategy = (id: string) => {
    setSelectedStrategies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl icon-wrapper-primary flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-primary-500" />
            </div>
            <h2 className="text-xl font-display font-bold text-theme-primary">New Scan</h2>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-surface-800" : "hover:bg-surface-100"
            )}
          >
            <XCircle className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Scan Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter scan name"
                className="input"
              />
            </div>

            <div>
              <label className="label">Select Strategies</label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {strategies.map((strategy) => (
                  <button
                    key={strategy.id}
                    type="button"
                    onClick={() => toggleStrategy(strategy.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all",
                      selectedStrategies.includes(strategy.id)
                        ? "bg-primary-500/10 border-primary-500/30"
                        : theme === 'dark'
                          ? "bg-surface-800/30 border-surface-700/50 hover:border-surface-600"
                          : "bg-surface-50 border-surface-200 hover:border-surface-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-theme-primary">{strategy.display_name}</span>
                      {selectedStrategies.includes(strategy.id) && (
                        <CheckCircle className="w-5 h-5 text-primary-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-theme-tertiary">
                {selectedStrategies.length} strategies selected
              </p>
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
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    Start Scan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
