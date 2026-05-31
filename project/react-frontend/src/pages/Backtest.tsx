import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { StockSearch } from '@/components/ui/StockSearch';
import { backtestApi } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  BarChart3,
  Play,
  Loader2,
  AlertCircle,
  FlaskConical,
  Target,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import type { BacktestResult, StrategyInfo } from '@/types';

export function Backtest() {
  const { theme } = useTheme();
  const [symbol, setSymbol] = useState('RELIANCE');
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [lookbackDays, setLookbackDays] = useState(365);

  const { data: strategies } = useQuery({
    queryKey: ['backtest-strategies'],
    queryFn: backtestApi.strategies,
  });

  const mutation = useMutation({
    mutationFn: backtestApi.run,
  });

  // Reset stale results when inputs change so user doesn't see old data
  const handleSymbolChange = (s: string) => { setSymbol(s); mutation.reset(); };
  const handleStrategyChange = (s: string) => { setSelectedStrategy(s); mutation.reset(); };
  const handleLookbackChange = (d: number) => { setLookbackDays(d); mutation.reset(); };
  const handleCapitalChange = (c: number) => { setInitialCapital(c); mutation.reset(); };

  const handleRun = () => {
    if (!symbol || !selectedStrategy) return;
    mutation.mutate({
      symbol,
      strategy_name: selectedStrategy,
      initial_capital: initialCapital,
      lookback_days: lookbackDays,
    });
  };

  const result = mutation.data;

  const selectedStrategyInfo = strategies?.find(
    (s: StrategyInfo) => s.name === selectedStrategy
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl icon-wrapper-primary">
              <FlaskConical className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-theme-primary">Backtesting</h1>
              <p className="text-theme-secondary mt-0.5">Test strategies against historical data</p>
            </div>
          </div>
          <button
            onClick={handleRun}
            disabled={mutation.isPending || !symbol || !selectedStrategy}
            className="btn-primary py-2.5 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run Backtest
          </button>
        </div>

        {/* Configuration Card - Two-row layout; overflow-visible so dropdown isn't clipped */}
        <div className="card !overflow-visible p-6 animate-slide-up">
          {/* Row 1: Stock Search + Strategy (these have dropdowns that need overflow space) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="relative z-20">
              <label className="label flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-primary-500" />
                Symbol
              </label>
              <StockSearch value={symbol} onChange={handleSymbolChange} />
            </div>
            <div className="relative z-10">
              <label className="label flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-primary-500" />
                Strategy
              </label>
              <select
                value={selectedStrategy}
                onChange={(e) => handleStrategyChange(e.target.value)}
                className="select"
              >
                <option value="">Select strategy</option>
                {strategies?.map((s: StrategyInfo) => (
                  <option key={s.name} value={s.name}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Capital + Lookback */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-primary-500" />
                Initial Capital (₹)
              </label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => handleCapitalChange(Number(e.target.value))}
                className="input"
                min={1000}
                step={10000}
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-primary-500" />
                Lookback Period
              </label>
              <select
                value={lookbackDays}
                onChange={(e) => handleLookbackChange(Number(e.target.value))}
                className="select"
              >
                <option value={90}>3 Months</option>
                <option value={180}>6 Months</option>
                <option value={365}>1 Year</option>
                <option value={730}>2 Years</option>
                <option value={1095}>3 Years</option>
              </select>
            </div>
          </div>

          {/* Strategy description hint */}
          {selectedStrategyInfo && (
            <div className={cn(
              "mt-4 flex items-start gap-2 p-3 rounded-xl text-sm",
              theme === 'dark' ? "bg-surface-800/50 text-theme-secondary" : "bg-surface-50 text-theme-secondary"
            )}>
              <Info className="w-4 h-4 mt-0.5 text-primary-500 flex-shrink-0" />
              <span>{selectedStrategyInfo.description}</span>
            </div>
          )}
        </div>

        {mutation.isError && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-500 animate-slide-up">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            Failed to run backtest. Check symbol and try again.
          </div>
        )}

        {result && (
          <>
            {/* Performance Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-slide-up">
              <MetricCard
                label="Total Return"
                value={`${result.total_return >= 0 ? '+' : ''}${result.total_return.toFixed(2)}%`}
                icon={result.total_return >= 0 ? ArrowUpRight : ArrowDownRight}
                positive={result.total_return >= 0}
                theme={theme}
              />
              <MetricCard
                label="Annual Return"
                value={`${result.annual_return >= 0 ? '+' : ''}${result.annual_return.toFixed(2)}%`}
                icon={Activity}
                positive={result.annual_return >= 0}
                theme={theme}
              />
              <MetricCard
                label="Max Drawdown"
                value={`${result.max_drawdown.toFixed(2)}%`}
                icon={TrendingDown}
                positive={false}
                theme={theme}
              />
              <MetricCard
                label="Sharpe Ratio"
                value={result.sharpe_ratio.toFixed(2)}
                icon={BarChart3}
                positive={result.sharpe_ratio > 1}
                theme={theme}
              />
              <MetricCard
                label="Win Rate"
                value={`${result.win_rate.toFixed(1)}%`}
                icon={Target}
                positive={result.win_rate > 50}
                theme={theme}
              />
              <MetricCard
                label="Final Capital"
                value={`₹${result.final_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                icon={DollarSign}
                positive={result.final_capital > result.initial_capital}
                theme={theme}
              />
            </div>

            {/* Equity Curve Chart */}
            <div className="card p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary-500" />
                  Equity Curve
                </h3>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-green-500 rounded" />
                    <span className="text-theme-tertiary">Portfolio</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 border-t border-dashed border-theme-secondary" />
                    <span className="text-theme-tertiary">Initial</span>
                  </div>
                </div>
              </div>
              <EquityChart result={result} theme={theme} />
            </div>

            {/* Detailed Stats + Trade Log */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary-500" />
                    Statistics
                  </h3>
                </div>
                <div className="card-body space-y-3">
                  <StatRow label="Total Trades" value={result.total_trades} />
                  <StatRow label="Winning Trades" value={result.winning_trades} valueColor="text-green-500" />
                  <StatRow label="Losing Trades" value={result.losing_trades} valueColor="text-red-500" />
                  <div className="divider my-3" />
                  <StatRow label="Avg Win" value={`₹${result.avg_win.toFixed(2)}`} valueColor="text-green-500" />
                  <StatRow label="Avg Loss" value={`₹${result.avg_loss.toFixed(2)}`} valueColor="text-red-500" />
                  <StatRow label="Profit Factor" value={result.profit_factor.toFixed(2)} highlight={result.profit_factor > 1} />
                  <div className="divider my-3" />
                  <StatRow
                    label="Period"
                    value={`${result.start_date.split('T')[0]} → ${result.end_date.split('T')[0]}`}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-header flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary-500" />
                    Trade Log
                  </h3>
                  <span className="badge-info">{result.trades?.length || 0} trades</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th className="text-right">Price</th>
                        <th>Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades?.map((trade, i) => (
                        <tr key={i}>
                          <td className="text-theme-secondary font-mono text-xs">
                            {trade.date.split('T')[0]}
                          </td>
                          <td>
                            <span
                              className={cn(
                                'badge text-xs',
                                trade.type === 'entry'
                                  ? 'badge-success'
                                  : 'badge-danger'
                              )}
                            >
                              {trade.type === 'entry' ? '↗ Entry' : '↘ Exit'}
                            </span>
                          </td>
                          <td className="text-right font-mono text-theme-primary">
                            ₹{trade.price.toFixed(2)}
                          </td>
                          <td className="text-theme-secondary text-xs">{trade.signal}</td>
                        </tr>
                      ))}
                      {(!result.trades || result.trades.length === 0) && (
                        <tr>
                          <td colSpan={4} className="text-center text-theme-tertiary py-8">
                            No trades executed in this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Empty state when no result yet */}
        {!result && !mutation.isPending && !mutation.isError && (
          <div className={cn(
            "border-2 border-dashed rounded-2xl p-12 text-center animate-slide-up",
            theme === 'dark' ? "border-surface-700" : "border-surface-300"
          )}>
            <div className={cn(
              "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center",
              theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
            )}>
              <FlaskConical className="w-8 h-8 text-theme-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-theme-primary mb-2">
              Configure & Run Your Backtest
            </h3>
            <p className="text-theme-secondary text-sm max-w-md mx-auto">
              Select a stock and strategy above, then click "Run Backtest" to see historical performance metrics and trade signals.
            </p>
          </div>
        )}

        {/* Loading state */}
        {mutation.isPending && (
          <div className="card p-12 text-center animate-slide-up">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
            <p className="text-theme-secondary">Running backtest for {symbol}...</p>
            <p className="text-theme-tertiary text-sm mt-1">This may take a few seconds</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string | number;
  icon: typeof TrendingUp;
  positive: boolean;
  theme?: string;
}) {
  return (
    <div className="card p-4 relative overflow-hidden group">
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        positive
          ? "bg-gradient-to-br from-green-500/5 to-transparent"
          : "bg-gradient-to-br from-red-500/5 to-transparent"
      )} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            positive ? "bg-green-500/10" : "bg-red-500/10"
          )}>
            <Icon className={cn('w-3.5 h-3.5', positive ? 'text-green-500' : 'text-red-500')} />
          </div>
          <span className="text-xs text-theme-tertiary font-medium">{label}</span>
        </div>
        <div
          className={cn(
            'text-lg font-bold font-mono',
            positive ? 'text-green-500' : 'text-red-500'
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  valueColor,
  highlight,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-theme-secondary text-sm">{label}</span>
      <span className={cn(
        'font-medium text-sm font-mono',
        valueColor || (highlight ? 'text-primary-500' : 'text-theme-primary')
      )}>
        {value}
      </span>
    </div>
  );
}

function EquityChart({ result, theme }: { result: BacktestResult; theme: string }) {
  if (!result.equity_curve || result.equity_curve.length === 0) {
    return (
      <div className={cn(
        "h-64 flex items-center justify-center rounded-xl",
        theme === 'dark' ? "bg-surface-800/30" : "bg-surface-50"
      )}>
        <p className="text-theme-secondary">No equity data available</p>
      </div>
    );
  }

  const data = result.equity_curve;
  const minVal = Math.min(...data) * 0.98;
  const maxVal = Math.max(...data) * 1.02;
  const range = maxVal - minVal;

  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 30, left: 70 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((val, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((val - minVal) / range) * chartH;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${padding.left + chartW},${padding.top + chartH} L ${padding.left},${padding.top + chartH} Z`;

  const isPositive = data[data.length - 1] >= data[0];
  const color = isPositive ? '#10b981' : '#ef4444';

  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minVal + (range * i) / yTicks;
    return { val, y: padding.top + chartH - (i / yTicks) * chartH };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((tick, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={tick.y}
            x2={padding.left + chartW}
            y2={tick.y}
            stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'}
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            fill={theme === 'dark' ? '#94a3b8' : '#64748b'}
            fontSize={11}
            fontFamily="ui-monospace, monospace"
          >
            ₹{(tick.val / 1000).toFixed(0)}K
          </text>
        </g>
      ))}

      {/* Area */}
      <path d={areaPath} fill="url(#equityGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Initial capital reference line */}
      {(() => {
        const initY =
          padding.top +
          chartH -
          ((result.initial_capital - minVal) / range) * chartH;
        return (
          <line
            x1={padding.left}
            y1={initY}
            x2={padding.left + chartW}
            y2={initY}
            stroke={theme === 'dark' ? '#64748b' : '#94a3b8'}
            strokeWidth={1}
            strokeDasharray="6,4"
          />
        );
      })()}

      {/* Start and end dots */}
      <circle
        cx={padding.left}
        cy={padding.top + chartH - ((data[0] - minVal) / range) * chartH}
        r={4}
        fill={color}
        stroke={theme === 'dark' ? '#0f172a' : '#ffffff'}
        strokeWidth={2}
      />
      <circle
        cx={padding.left + chartW}
        cy={padding.top + chartH - ((data[data.length - 1] - minVal) / range) * chartH}
        r={4}
        fill={color}
        stroke={theme === 'dark' ? '#0f172a' : '#ffffff'}
        strokeWidth={2}
      />
    </svg>
  );
}
