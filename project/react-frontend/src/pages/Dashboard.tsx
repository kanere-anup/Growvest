import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { strategiesApi, scansApi, analyticsApi } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTheme } from '@/context/ThemeContext';
import {
  TrendingUp,
  Layers,
  Scan,
  Activity,
  ArrowRight,
  PlayCircle,
  BarChart3,
  Loader2,
  Sparkles,
  CheckCircle,
  Clock,
  Zap,
  Rocket,
} from 'lucide-react';
import { formatDateTime, formatDuration, cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();

  // Fetch data
  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: strategiesApi.list,
  });

  const { data: userStrategies, isLoading: userStrategiesLoading } = useQuery({
    queryKey: ['user-strategies'],
    queryFn: strategiesApi.listUserStrategies,
  });

  const { data: scansData, isLoading: scansLoading } = useQuery({
    queryKey: ['scans', { limit: 5 }],
    queryFn: () => scansApi.list({ limit: 5 }),
    // Poll every 3 seconds if there are running/pending scans
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActiveScans = data?.items?.some(
        (scan) => scan.status === 'running' || scan.status === 'pending'
      );
      return hasActiveScans ? 3000 : false;
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics-performance'],
    queryFn: () => analyticsApi.getPerformance(30),
  });

  const isLoading = strategiesLoading || userStrategiesLoading || scansLoading || analyticsLoading;

  const enabledStrategies = userStrategies?.filter((s) => s.is_enabled).length || 0;
  const recentScans = scansData?.items || [];
  const completedScans = recentScans.filter((s) => s.status === 'completed').length;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: <CheckCircle className="w-3 h-3" />, class: 'badge-success' };
      case 'running':
        return { icon: <Loader2 className="w-3 h-3 animate-spin" />, class: 'badge-info' };
      case 'pending':
        return { icon: <Clock className="w-3 h-3" />, class: 'badge-warning' };
      default:
        return { icon: null, class: 'badge-neutral' };
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Rocket className="w-5 h-5 text-primary-500" />
              <span className="text-sm font-medium text-primary-500">Dashboard</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-theme-primary">
              Welcome back, {user?.full_name?.split(' ')[0] || 'Investor'}!
            </h1>
            <p className="text-theme-secondary mt-1">
              Here's your stock screening overview.
            </p>
          </div>
          <Link to="/scans">
            <button className="btn-primary">
              <PlayCircle className="w-4 h-4" />
              Start New Scan
            </button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl icon-wrapper-primary flex items-center justify-center">
                <Layers className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-theme-secondary">Available Strategies</p>
                <p className="text-2xl font-bold text-theme-primary">
                  {isLoading ? '-' : strategies?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card animate-slide-up animate-delay-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl icon-wrapper-success flex items-center justify-center">
                <Activity className="w-6 h-6 text-success-500" />
              </div>
              <div>
                <p className="text-sm text-theme-secondary">Enabled Strategies</p>
                <p className="text-2xl font-bold text-theme-primary">
                  {isLoading ? '-' : enabledStrategies}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card animate-slide-up animate-delay-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl icon-wrapper-info flex items-center justify-center">
                <Scan className="w-6 h-6 text-info-500" />
              </div>
              <div>
                <p className="text-sm text-theme-secondary">Recent Scans</p>
                <p className="text-2xl font-bold text-theme-primary">
                  {isLoading ? '-' : recentScans.length}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card animate-slide-up animate-delay-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl icon-wrapper-warning flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-warning-500" />
              </div>
              <div>
                <p className="text-sm text-theme-secondary">Completed Scans</p>
                <p className="text-2xl font-bold text-theme-primary">
                  {isLoading ? '-' : completedScans}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Strategies Overview */}
          <div className="lg:col-span-2 card animate-slide-up animate-delay-200">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500" />
                Available Strategies
              </h2>
              <Link to="/strategies" className="text-sm text-primary-500 hover:text-primary-400 flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="card-body">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {strategies?.slice(0, 4).map((strategy) => {
                    const isConfigured = userStrategies?.some((us) => us.strategy_id === strategy.id);
                    return (
                      <div
                        key={strategy.id}
                        className={cn(
                          "p-4 rounded-xl border transition-all duration-200",
                          isConfigured 
                            ? "bg-primary-500/5 border-primary-500/20 hover:border-primary-500/40" 
                            : theme === 'dark'
                              ? "bg-surface-800/30 border-surface-700/50 hover:border-surface-600"
                              : "bg-surface-50 border-surface-200 hover:border-surface-300"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-theme-primary">{strategy.display_name}</h4>
                            <p className="text-sm text-theme-secondary mt-1 line-clamp-2">
                              {strategy.description}
                            </p>
                          </div>
                          <span className={isConfigured ? 'badge-success' : 'badge-neutral'}>
                            {isConfigured ? 'Active' : 'Available'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Scans */}
          <div className="card animate-slide-up animate-delay-300">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                <Zap className="w-5 h-5 text-warning-500" />
                Recent Scans
              </h2>
              <Link to="/scans" className="text-sm text-primary-500 hover:text-primary-400 flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="card-body">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                </div>
              ) : recentScans.length > 0 ? (
                <div className="space-y-3">
                  {recentScans.map((scan) => {
                    const statusConfig = getStatusConfig(scan.status);
                    return (
                      <Link
                        key={scan.id}
                        to={`/scans/${scan.id}`}
                        className={cn(
                          "block p-4 rounded-xl border transition-all duration-200",
                          theme === 'dark'
                            ? "bg-surface-800/30 border-surface-700/50 hover:border-surface-600"
                            : "bg-surface-50 border-surface-200 hover:border-surface-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-theme-primary">
                              {scan.name || `Scan #${scan.id.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-theme-tertiary mt-1">
                              {formatDateTime(scan.created_at)}
                            </p>
                          </div>
                          <span className={cn("flex items-center gap-1", statusConfig.class)}>
                            {statusConfig.icon}
                            {scan.status}
                          </span>
                        </div>
                        {scan.status === 'completed' && (
                          <div className="mt-2 text-xs text-theme-secondary">
                            {scan.results_count || scan.successful_stocks} results • {formatDuration(scan.execution_time_ms)}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className={cn(
                    "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center",
                    theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
                  )}>
                    <Scan className="w-8 h-8 text-theme-tertiary" />
                  </div>
                  <p className="text-theme-secondary text-sm mb-4">No scans yet</p>
                  <Link to="/scans">
                    <button className="btn-secondary text-sm">
                      Start your first scan
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Strategy Performance */}
        {analytics && analytics.strategies && analytics.strategies.length > 0 && (
          <div className="card animate-slide-up animate-delay-400">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success-500" />
                Strategy Performance (Last 30 Days)
              </h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {analytics.strategies.map((stat) => (
                  <div
                    key={stat.strategy_name}
                    className={cn(
                      "p-5 rounded-xl border",
                      theme === 'dark'
                        ? "bg-surface-800/30 border-surface-700/50"
                        : "bg-surface-50 border-surface-200"
                    )}
                  >
                    <h4 className="font-medium text-theme-primary mb-3">{stat.strategy_display_name}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-theme-secondary">Total Results</span>
                        <span className="font-medium text-theme-primary">{stat.total_results}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-theme-secondary">Unique Stocks</span>
                        <span className="font-medium text-theme-primary">{stat.unique_stocks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-theme-secondary">Avg Score</span>
                        <span className="font-medium text-primary-500">{stat.avg_score.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
