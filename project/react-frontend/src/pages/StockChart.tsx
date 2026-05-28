import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { StockSearch } from '@/components/ui/StockSearch';
import { chartApi } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import {
  CandlestickChart as ChartIcon,
  TrendingDown,
  BarChart3,
  Loader2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function StockChart() {
  const { theme } = useTheme();
  const { symbol: paramSymbol } = useParams<{ symbol: string }>();
  const [symbol, setSymbol] = useState(paramSymbol || 'RELIANCE');
  const [timeframe, setTimeframe] = useState(365);
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');

  const { data: chartResponse, isLoading, isError } = useQuery({
    queryKey: ['chart-data', symbol, timeframe],
    queryFn: () => chartApi.getData(symbol, timeframe),
    enabled: !!symbol,
    retry: 1,
  });

  const chartData: OHLCVData[] = chartResponse?.points || [];

  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].close : 0;
  const firstPrice = chartData.length > 0 ? chartData[0].close : 0;
  const priceChange = lastPrice - firstPrice;
  const pctChange = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
  const highPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.high)) : 0;
  const lowPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.low)) : 0;
  const avgVolume = chartData.length > 0 ? chartData.reduce((s, d) => s + d.volume, 0) / chartData.length : 0;

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl icon-wrapper-primary">
                <ChartIcon className="w-5 h-5 text-primary-500" />
              </div>
              <div className="relative z-20">
                <StockSearch value={symbol} onChange={setSymbol} className="w-72" />
              </div>
              {chartData.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-theme-primary font-mono">
                    ₹{lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                  <span className={cn(
                    'flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-lg',
                    pctChange >= 0
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  )}>
                    {pctChange >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {[
                { label: '1M', days: 30 },
                { label: '3M', days: 90 },
                { label: '6M', days: 180 },
                { label: '1Y', days: 365 },
                { label: '2Y', days: 730 },
              ].map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => setTimeframe(tf.days)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                    timeframe === tf.days
                      ? 'bg-primary-500 text-white shadow-sm'
                      : theme === 'dark'
                      ? 'bg-surface-800 text-theme-secondary hover:bg-surface-700 hover:text-theme-primary'
                      : 'bg-surface-100 text-theme-secondary hover:bg-surface-200 hover:text-theme-primary'
                  )}
                >
                  {tf.label}
                </button>
              ))}

              <div className="w-px h-6 bg-theme-secondary/20 mx-1" />

              {(['candlestick', 'line'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all duration-200',
                    chartType === type
                      ? 'bg-primary-500 text-white shadow-sm'
                      : theme === 'dark'
                      ? 'bg-surface-800 text-theme-secondary hover:bg-surface-700 hover:text-theme-primary'
                      : 'bg-surface-100 text-theme-secondary hover:bg-surface-200 hover:text-theme-primary'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Quick stats bar */}
          {chartData.length > 0 && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-theme-tertiary">High:</span>
                <span className="font-mono font-medium text-green-500">₹{highPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-theme-tertiary">Low:</span>
                <span className="font-mono font-medium text-red-500">₹{lowPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-theme-tertiary">Avg Vol:</span>
                <span className="font-mono font-medium text-theme-secondary">
                  {avgVolume >= 1000000
                    ? `${(avgVolume / 1000000).toFixed(1)}M`
                    : avgVolume >= 1000
                    ? `${(avgVolume / 1000).toFixed(0)}K`
                    : avgVolume.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-theme-tertiary" />
                <span className="text-theme-tertiary">{chartData.length} candles</span>
              </div>
            </div>
          )}
        </div>

        <div className="card p-4">
          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-theme-secondary">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              <span>Loading chart data for {symbol}...</span>
            </div>
          ) : isError ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center",
                theme === 'dark' ? "bg-red-500/10" : "bg-red-50"
              )}>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-500 font-medium">Failed to load data for {symbol}</p>
              <p className="text-theme-tertiary text-sm">Check the symbol and try again</p>
            </div>
          ) : chartData.length > 0 ? (
            <CandlestickChart data={chartData} chartType={chartType} theme={theme} />
          ) : (
            <div className="h-96 flex flex-col items-center justify-center gap-3">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center",
                theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
              )}>
                <BarChart3 className="w-8 h-8 text-theme-tertiary" />
              </div>
              <p className="text-theme-secondary font-medium">
                {symbol ? `No data available for ${symbol}` : 'Select a stock to view chart'}
              </p>
            </div>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-medium text-theme-tertiary mb-2 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Volume
            </h3>
            <VolumeChart data={chartData} theme={theme} />
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function CandlestickChart({
  data,
  chartType,
  theme,
}: {
  data: OHLCVData[];
  chartType: 'candlestick' | 'line';
  theme: string;
}) {
  const width = 900;
  const height = 400;
  const padding = { top: 20, right: 60, bottom: 30, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const { minPrice, maxPrice, candleWidth } = useMemo(() => {
    const prices = data.flatMap((d) => [d.high, d.low]);
    const min = Math.min(...prices) * 0.998;
    const max = Math.max(...prices) * 1.002;
    const cw = Math.max(1, Math.min(8, (chartW / data.length) * 0.7));
    return { minPrice: min, maxPrice: max, candleWidth: cw };
  }, [data, chartW]);

  const priceRange = maxPrice - minPrice;
  const toY = (price: number) =>
    padding.top + chartH - ((price - minPrice) / priceRange) * chartH;
  const toX = (i: number) =>
    padding.left + (i / data.length) * chartW + chartW / data.length / 2;

  const yTicks = 6;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const price = minPrice + (priceRange * i) / yTicks;
    return { price, y: toY(price) };
  });

  const xTickInterval = Math.max(1, Math.floor(data.length / 8));

  if (chartType === 'line') {
    const linePath = data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)},${toY(d.close)}`)
      .join(' ');

    const areaPath = `${linePath} L ${toX(data.length - 1)},${padding.top + chartH} L ${toX(0)},${padding.top + chartH} Z`;

    const isPositive = data[data.length - 1].close >= data[0].close;
    const color = isPositive ? '#10b981' : '#ef4444';

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {yLabels.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left} y1={tick.y}
              x2={width - padding.right} y2={tick.y}
              stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'}
              strokeWidth={1}
            />
            <text
              x={width - padding.right + 6} y={tick.y + 4}
              fill={theme === 'dark' ? '#64748b' : '#94a3b8'}
              fontSize={10}
              fontFamily="ui-monospace, monospace"
            >
              ₹{tick.price.toFixed(0)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % xTickInterval === 0 ? (
            <text key={i} x={toX(i)} y={height - 5} textAnchor="middle"
              fill={theme === 'dark' ? '#64748b' : '#94a3b8'} fontSize={9}
              fontFamily="ui-monospace, monospace">
              {d.date.slice(5)}
            </text>
          ) : null
        )}
        <path d={areaPath} fill="url(#lineAreaGrad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {yLabels.map((tick, i) => (
        <g key={i}>
          <line
            x1={padding.left} y1={tick.y}
            x2={width - padding.right} y2={tick.y}
            stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'}
            strokeWidth={1}
          />
          <text
            x={width - padding.right + 6} y={tick.y + 4}
            fill={theme === 'dark' ? '#64748b' : '#94a3b8'}
            fontSize={10}
            fontFamily="ui-monospace, monospace"
          >
            ₹{tick.price.toFixed(0)}
          </text>
        </g>
      ))}
      {data.map((d, i) =>
        i % xTickInterval === 0 ? (
          <text key={i} x={toX(i)} y={height - 5} textAnchor="middle"
            fill={theme === 'dark' ? '#64748b' : '#94a3b8'} fontSize={9}
            fontFamily="ui-monospace, monospace">
            {d.date.slice(5)}
          </text>
        ) : null
      )}
      {data.map((d, i) => {
        const x = toX(i);
        const isGreen = d.close >= d.open;
        const color = isGreen ? '#10b981' : '#ef4444';
        const bodyTop = toY(Math.max(d.open, d.close));
        const bodyBottom = toY(Math.min(d.open, d.close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);

        return (
          <g key={i}>
            <line x1={x} y1={toY(d.high)} x2={x} y2={toY(d.low)} stroke={color} strokeWidth={1} />
            <rect
              x={x - candleWidth / 2} y={bodyTop}
              width={candleWidth} height={bodyHeight}
              fill={color} stroke={color} strokeWidth={0.5} rx={0.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

function VolumeChart({ data }: { data: OHLCVData[]; theme?: string }) {
  const width = 900;
  const height = 80;
  const padding = { left: 10, right: 60 };
  const chartW = width - padding.left - padding.right;
  const maxVol = Math.max(...data.map((d) => d.volume));
  const barWidth = Math.max(1, Math.min(8, (chartW / data.length) * 0.7));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {data.map((d, i) => {
        const x = padding.left + (i / data.length) * chartW + chartW / data.length / 2;
        const barH = maxVol > 0 ? (d.volume / maxVol) * (height - 10) : 0;
        const isGreen = d.close >= d.open;
        return (
          <rect key={i}
            x={x - barWidth / 2} y={height - barH}
            width={barWidth} height={barH}
            fill={isGreen ? '#10b98140' : '#ef444440'}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}
