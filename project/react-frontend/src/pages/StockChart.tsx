import { useState, useMemo, useRef, useCallback } from 'react';
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

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
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
                    {formatPrice(lastPrice)}
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
                { label: '5Y', days: 1825 },
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
                <span className="font-mono font-medium text-green-500">{formatPrice(highPrice)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-theme-tertiary">Low:</span>
                <span className="font-mono font-medium text-red-500">{formatPrice(lowPrice)}</span>
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
            <InteractiveCandlestickChart data={chartData} chartType={chartType} theme={theme} />
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

// The chart uses a split layout: scrollable candle area + fixed right Y-axis
function InteractiveCandlestickChart({
  data,
  chartType,
  theme,
}: {
  data: OHLCVData[];
  chartType: 'candlestick' | 'line';
  theme: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    index: number;
    mouseY: number; // in SVG coords
    mousePrice: number;
  } | null>(null);

  const yAxisWidth = 80;
  const svgWidth = Math.max(900, data.length * 6);
  const height = 420;
  const padding = { top: 20, right: 4, bottom: 35, left: 10 };
  const chartW = svgWidth - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const { minPrice, maxPrice, candleWidth } = useMemo(() => {
    const prices = data.flatMap((d) => [d.high, d.low]);
    const min = Math.min(...prices) * 0.998;
    const max = Math.max(...prices) * 1.002;
    const cw = Math.max(2, Math.min(8, (chartW / data.length) * 0.7));
    return { minPrice: min, maxPrice: max, candleWidth: cw };
  }, [data, chartW]);

  const priceRange = maxPrice - minPrice;
  const toY = useCallback((price: number) =>
    padding.top + chartH - ((price - minPrice) / priceRange) * chartH,
    [chartH, minPrice, priceRange]
  );
  const fromY = useCallback((y: number) =>
    minPrice + ((padding.top + chartH - y) / chartH) * priceRange,
    [chartH, minPrice, priceRange]
  );
  const toX = useCallback((i: number) =>
    padding.left + (i / data.length) * chartW + chartW / data.length / 2,
    [data.length, chartW]
  );

  const yTicks = 8;
  const yLabels = useMemo(() => Array.from({ length: yTicks + 1 }, (_, i) => {
    const price = minPrice + (priceRange * i) / yTicks;
    return { price, y: toY(price) };
  }), [minPrice, priceRange, toY]);

  const xTickInterval = Math.max(1, Math.floor(data.length / 12));

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const scaleY = height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseYsvg = (e.clientY - rect.top) * scaleY;

    // Clamp mouseY to chart area
    const clampedY = Math.max(padding.top, Math.min(padding.top + chartH, mouseYsvg));
    const mousePrice = fromY(clampedY);

    // Find closest data index
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(toX(i) - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setHoverInfo({ index: closest, mouseY: clampedY, mousePrice });
  }, [data.length, toX, svgWidth, height, chartH, fromY]);

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  const hoverData = hoverInfo ? data[hoverInfo.index] : null;
  const prevData = hoverInfo && hoverInfo.index > 0 ? data[hoverInfo.index - 1] : null;
  const dayChange = hoverData && prevData ? ((hoverData.close - prevData.close) / prevData.close * 100) : null;

  const gridColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const textColor = theme === 'dark' ? '#64748b' : '#94a3b8';
  const crosshairColor = theme === 'dark' ? '#475569' : '#94a3b8';

  // Shared grid + axis rendering
  const renderGrid = () => (
    <>
      {yLabels.map((tick, i) => (
        <line key={i} x1={padding.left} y1={tick.y} x2={svgWidth - padding.right} y2={tick.y} stroke={gridColor} strokeWidth={1} />
      ))}
    </>
  );

  const renderXLabels = () => (
    <>
      {data.map((d, i) =>
        i % xTickInterval === 0 ? (
          <text key={i} x={toX(i)} y={height - 5} textAnchor="middle" fill={textColor} fontSize={9} fontFamily="ui-monospace, monospace">
            {formatDateLabel(d.date)}
          </text>
        ) : null
      )}
    </>
  );

  const renderCrosshair = () => {
    if (!hoverInfo || !hoverData) return null;
    return (
      <>
        {/* Vertical dotted line at candle */}
        <line
          x1={toX(hoverInfo.index)} y1={padding.top}
          x2={toX(hoverInfo.index)} y2={padding.top + chartH}
          stroke={crosshairColor} strokeWidth={1} strokeDasharray="4 3"
        />
        {/* Horizontal dotted line follows mouse Y exactly */}
        <line
          x1={padding.left} y1={hoverInfo.mouseY}
          x2={svgWidth - padding.right} y2={hoverInfo.mouseY}
          stroke={crosshairColor} strokeWidth={1} strokeDasharray="4 3"
        />
        {/* Date label on X-axis bottom */}
        <rect
          x={toX(hoverInfo.index) - 42} y={padding.top + chartH + 2}
          width={84} height={18} rx={4}
          fill={theme === 'dark' ? '#334155' : '#1e293b'}
        />
        <text
          x={toX(hoverInfo.index)} y={padding.top + chartH + 14}
          textAnchor="middle" fill="#f8fafc" fontSize={9} fontFamily="ui-monospace, monospace"
        >
          {formatDateLabel(hoverData.date)}
        </text>
      </>
    );
  };

  // Render OHLCV info bar (positioned above chart, outside scroll)
  const renderInfoBar = () => {
    if (!hoverData) return null;
    return (
      <div className="flex items-center gap-4 text-xs font-mono mb-1 min-h-[18px]">
        <span className="text-theme-tertiary">{formatDateFull(hoverData.date)}</span>
        <span className="text-theme-secondary">O: <span className="text-theme-primary">{hoverData.open.toFixed(2)}</span></span>
        <span className="text-theme-secondary">H: <span className="text-green-500">{hoverData.high.toFixed(2)}</span></span>
        <span className="text-theme-secondary">L: <span className="text-red-500">{hoverData.low.toFixed(2)}</span></span>
        <span className="text-theme-secondary">C: <span className="text-theme-primary">{hoverData.close.toFixed(2)}</span></span>
        <span className="text-theme-secondary">Vol: <span className="text-theme-primary">{(hoverData.volume / 1000).toFixed(0)}K</span></span>
        {dayChange !== null && (
          <span className={dayChange >= 0 ? 'text-green-500' : 'text-red-500'}>
            {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)}%
          </span>
        )}
      </div>
    );
  };

  // Fixed Y-axis component (rendered outside the scrollable area)
  const renderYAxis = () => (
    <svg viewBox={`0 0 ${yAxisWidth} ${height}`} width={yAxisWidth} className="flex-shrink-0" style={{ height: 'auto', aspectRatio: `${yAxisWidth}/${height}` }}>
      {/* Tick labels */}
      {yLabels.map((tick, i) => (
        <text key={i} x={8} y={tick.y + 4} fill={textColor} fontSize={10} fontFamily="ui-monospace, monospace">
          {tick.price.toFixed(2)}
        </text>
      ))}
      {/* Mouse price label — follows cursor Y */}
      {hoverInfo && (
        <>
          <rect
            x={0} y={hoverInfo.mouseY - 10}
            width={yAxisWidth - 2} height={20} rx={4}
            fill={theme === 'dark' ? '#334155' : '#1e293b'}
          />
          <text
            x={6} y={hoverInfo.mouseY + 4}
            fill="#f8fafc" fontSize={10} fontWeight="bold" fontFamily="ui-monospace, monospace"
          >
            ₹{hoverInfo.mousePrice.toFixed(2)}
          </text>
        </>
      )}
    </svg>
  );

  // Render candles or line
  const renderChartContent = () => {
    if (chartType === 'line') {
      const linePath = data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)},${toY(d.close)}`)
        .join(' ');
      const areaPath = `${linePath} L ${toX(data.length - 1)},${padding.top + chartH} L ${toX(0)},${padding.top + chartH} Z`;
      const isPositive = data[data.length - 1].close >= data[0].close;
      const color = isPositive ? '#10b981' : '#ef4444';

      return (
        <>
          <defs>
            <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#lineAreaGrad)" />
          <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* Dot on hovered point */}
          {hoverInfo && (
            <circle cx={toX(hoverInfo.index)} cy={toY(data[hoverInfo.index].close)} r={4} fill={color} stroke="white" strokeWidth={2} />
          )}
        </>
      );
    }

    // Candlestick
    return (
      <>
        {data.map((d, i) => {
          const x = toX(i);
          const isGreen = d.close >= d.open;
          const color = isGreen ? '#10b981' : '#ef4444';
          const bodyTop = toY(Math.max(d.open, d.close));
          const bodyBottom = toY(Math.min(d.open, d.close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);
          const isHovered = hoverInfo?.index === i;

          return (
            <g key={i} opacity={hoverInfo !== null && !isHovered ? 0.6 : 1}>
              <line x1={x} y1={toY(d.high)} x2={x} y2={toY(d.low)} stroke={color} strokeWidth={isHovered ? 2 : 1} />
              <rect
                x={x - candleWidth / 2} y={bodyTop}
                width={candleWidth} height={bodyHeight}
                fill={color} stroke={color} strokeWidth={0.5} rx={0.5}
              />
            </g>
          );
        })}
      </>
    );
  };

  return (
    <div className="relative">
      {/* OHLCV info bar — always visible above chart */}
      <div className="min-h-[18px] mb-1">
        {renderInfoBar()}
      </div>

      {/* Chart area: scrollable left + fixed Y-axis right */}
      <div className="flex">
        {/* Scrollable chart area */}
        <div ref={containerRef} className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <div style={{ width: svgWidth }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${height}`}
              className="w-full h-auto cursor-crosshair"
              style={{ display: 'block' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {renderGrid()}
              {renderXLabels()}
              {renderChartContent()}
              {renderCrosshair()}
            </svg>
          </div>
        </div>

        {/* Fixed Y-axis on right */}
        <div className="flex-shrink-0" style={{ width: yAxisWidth }}>
          {renderYAxis()}
        </div>
      </div>
    </div>
  );
}

function VolumeChart({ data }: { data: OHLCVData[]; theme?: string }) {
  const svgWidth = Math.max(900, data.length * 6);
  const height = 80;
  const yAxisWidth = 80;
  const padding = { left: 10, right: 4 };
  const chartW = svgWidth - padding.left - padding.right;
  const maxVol = Math.max(...data.map((d) => d.volume));
  const barWidth = Math.max(1, Math.min(8, (chartW / data.length) * 0.7));

  return (
    <div className="flex">
      <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <div style={{ width: svgWidth, minWidth: '100%' }}>
          <svg viewBox={`0 0 ${svgWidth} ${height}`} className="w-full h-auto" style={{ display: 'block' }}>
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
        </div>
      </div>
      {/* Spacer to align with price chart Y-axis */}
      <div className="flex-shrink-0" style={{ width: yAxisWidth }} />
    </div>
  );
}
