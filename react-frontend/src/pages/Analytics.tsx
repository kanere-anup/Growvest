import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTheme } from '@/context/ThemeContext';
import { 
  BarChart3, 
  TrendingUp, 
  Loader2, 
  Target, 
  Zap,
  Star,
  Award,
  ChevronUp,
} from 'lucide-react';
import { formatDate, formatNumber, cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

export function Analytics() {
  const { theme } = useTheme();
  const [days, setDays] = useState(30);

  // Fetch performance data
  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ['analytics-performance', days],
    queryFn: () => analyticsApi.getPerformance(days),
  });

  // Fetch top stocks
  const { data: topStocks, isLoading: stocksLoading } = useQuery({
    queryKey: ['analytics-top-stocks', days],
    queryFn: () => analyticsApi.getTopStocks({ days, limit: 10 }),
  });

  const isLoading = perfLoading || stocksLoading;

  const chartData = performance?.strategies?.map((stat) => ({
    name: stat.strategy_display_name.split(' ')[0],
    fullName: stat.strategy_display_name,
    results: stat.total_results,
    stocks: stat.unique_stocks,
    score: Math.round(stat.avg_score),
  })) || [];

  const pieData = performance?.strategies?.map((stat) => ({
    name: stat.strategy_display_name,
    value: stat.total_results,
  })) || [];

  const tooltipStyle = theme === 'dark' ? {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
  } : {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
  };

  const chartColors = {
    grid: theme === 'dark' ? '#334155' : '#e2e8f0',
    text: theme === 'dark' ? '#94a3b8' : '#64748b',
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl icon-wrapper-primary">
              <BarChart3 className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-theme-primary">Analytics</h1>
              <p className="text-theme-secondary mt-0.5">Performance insights and trends</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 p-1 rounded-xl bg-theme-tertiary">
              {[7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    days === d 
                      ? "bg-primary-500 text-white shadow-sm" 
                      : "text-theme-secondary hover:text-theme-primary"
                  )}
                >
                  {d === 365 ? '1Y' : `${d}D`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-4" />
              <p className="text-theme-secondary">Loading analytics...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Strategy Performance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {performance?.strategies?.map((stat, index) => (
                <div 
                  key={stat.strategy_name} 
                  className="card-hover p-5 animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${COLORS[index % COLORS.length]}15` }}
                    >
                      <TrendingUp 
                        className="w-6 h-6" 
                        style={{ color: COLORS[index % COLORS.length] }} 
                      />
                    </div>
                    <span 
                      className="badge" 
                      style={{ 
                        backgroundColor: `${COLORS[index % COLORS.length]}20`,
                        color: COLORS[index % COLORS.length],
                        border: `1px solid ${COLORS[index % COLORS.length]}30`
                      }}
                    >
                      {stat.strategy_display_name.split(' ')[0]}
                    </span>
                  </div>
                  <p className="text-sm text-theme-secondary">{stat.strategy_display_name}</p>
                  <p className="text-3xl font-display font-bold text-theme-primary mt-1">
                    {stat.total_results}
                  </p>
                  <p className="text-xs text-theme-tertiary">matches found</p>
                  
                  <div className="mt-4 pt-4 border-t border-[var(--border-primary)] grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-theme-tertiary block mb-1">Unique Stocks</span>
                      <span className="font-semibold text-theme-primary">{stat.unique_stocks}</span>
                    </div>
                    <div>
                      <span className="text-theme-tertiary block mb-1">Avg Score</span>
                      <span className="font-semibold text-theme-primary">{formatNumber(stat.avg_score, 1)}</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!performance?.strategies || performance.strategies.length === 0) && (
                <div className="col-span-full card p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl icon-wrapper flex items-center justify-center">
                    <BarChart3 className="w-8 h-8 text-theme-tertiary" />
                  </div>
                  <h3 className="text-lg font-semibold text-theme-primary mb-2">No Analytics Data</h3>
                  <p className="text-theme-secondary">Run some scans to see performance data</p>
                </div>
              )}
            </div>

            {/* Charts Row */}
            {chartData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="card animate-slide-up animate-delay-200">
                  <div className="card-header">
                    <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary-500" />
                      Results by Strategy
                    </h2>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartData} barGap={8}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke={chartColors.grid} 
                          vertical={false}
                        />
                        <XAxis 
                          dataKey="name" 
                          stroke={chartColors.text} 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke={chartColors.text} 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a', fontWeight: 600, marginBottom: '8px' }}
                          formatter={(value: number, name: string) => [
                            <span key={name} style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>
                              {value}
                            </span>, 
                            name === 'results' ? 'Results' : 'Unique Stocks'
                          ]}
                          labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName || label}
                        />
                        <Bar 
                          dataKey="results" 
                          fill="#10b981" 
                          radius={[6, 6, 0, 0]} 
                          name="Results"
                        />
                        <Bar 
                          dataKey="stocks" 
                          fill="#3b82f6" 
                          radius={[6, 6, 0, 0]} 
                          name="Unique Stocks"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart */}
                <div className="card animate-slide-up animate-delay-300">
                  <div className="card-header">
                    <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                      <Zap className="w-5 h-5 text-warning-500" />
                      Distribution
                    </h2>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]}
                              stroke="transparent"
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Custom Legend */}
                    <div className="flex flex-wrap justify-center gap-4 mt-2">
                      {pieData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm text-theme-secondary">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Stocks */}
            {topStocks && topStocks.length > 0 && (
              <div className="card animate-slide-up animate-delay-400">
                <div className="card-header flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                    <Award className="w-5 h-5 text-warning-500" />
                    Top Performing Stocks
                  </h2>
                  <span className="badge-info">Last {days} days</span>
                </div>
                <div className="card-body p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={cn(
                          "border-b",
                          theme === 'dark' ? "border-surface-800 bg-surface-800/30" : "border-surface-200 bg-surface-50"
                        )}>
                          <th className="px-6 py-4 text-left font-semibold text-theme-secondary uppercase text-xs tracking-wider">Rank</th>
                          <th className="px-6 py-4 text-left font-semibold text-theme-secondary uppercase text-xs tracking-wider">Symbol</th>
                          <th className="px-6 py-4 text-left font-semibold text-theme-secondary uppercase text-xs tracking-wider">Hits</th>
                          <th className="px-6 py-4 text-left font-semibold text-theme-secondary uppercase text-xs tracking-wider">Avg Score</th>
                          <th className="px-6 py-4 text-left font-semibold text-theme-secondary uppercase text-xs tracking-wider">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topStocks.map((stock, index) => (
                          <tr 
                            key={stock.symbol}
                            className={cn(
                              "border-b transition-colors",
                              theme === 'dark' 
                                ? "border-surface-800/50 hover:bg-surface-800/30" 
                                : "border-surface-100 hover:bg-surface-50"
                            )}
                          >
                            <td className="px-6 py-4">
                              {index < 3 ? (
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                                  index === 0 && "bg-yellow-500/20 text-yellow-500",
                                  index === 1 && "bg-surface-400/20 text-surface-400",
                                  index === 2 && "bg-amber-600/20 text-amber-600"
                                )}>
                                  {index === 0 && <Star className="w-4 h-4" />}
                                  {index > 0 && `#${index + 1}`}
                                </div>
                              ) : (
                                <span className="text-theme-tertiary font-medium">#{index + 1}</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono font-bold text-theme-primary">{stock.symbol}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1 font-semibold text-primary-500">
                                <ChevronUp className="w-4 h-4" />
                                {stock.hits}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="progress w-16">
                                  <div 
                                    className="progress-bar"
                                    style={{ width: `${Math.min(stock.avg_score, 100)}%` }}
                                  />
                                </div>
                                <span className="font-medium text-theme-primary">{formatNumber(stock.avg_score, 1)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-theme-secondary">
                              {formatDate(stock.last_seen)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
