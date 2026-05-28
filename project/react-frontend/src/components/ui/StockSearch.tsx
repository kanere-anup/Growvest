import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stocksApi } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, X, Loader2, TrendingUp } from 'lucide-react';

interface StockSearchProps {
  value: string;
  onChange: (symbol: string) => void;
  placeholder?: string;
  className?: string;
}

export function StockSearch({ value, onChange, placeholder = 'Search stocks...', className }: StockSearchProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: stocksData, isLoading } = useQuery({
    queryKey: ['stocks-search', search],
    queryFn: () => stocksApi.list({ limit: 50, active: true, search: search || undefined }),
    staleTime: 60000,
  });

  const stocks = stocksData?.items || [];

  const filtered = search
    ? stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.sector?.toLowerCase().includes(search.toLowerCase())
      )
    : stocks;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const [highlightIdx, setHighlightIdx] = useState(-1);

  useEffect(() => {
    setHighlightIdx(-1);
  }, [search, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0 && highlightIdx < filtered.length) {
      e.preventDefault();
      onChange(filtered[highlightIdx].symbol);
      setIsOpen(false);
      setSearch('');
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const selectedStock = stocks.find((s) => s.symbol === value);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all duration-200',
          theme === 'dark'
            ? 'bg-surface-800 border-surface-700 hover:border-surface-600'
            : 'bg-white border-surface-300 hover:border-surface-400',
          isOpen && 'ring-2 ring-primary-500/50 border-primary-500/50'
        )}
      >
        <Search className="w-4 h-4 text-theme-tertiary flex-shrink-0" />
        <span className={cn('flex-1 truncate', value ? 'text-theme-primary' : 'text-theme-tertiary')}>
          {value ? (
            <>
              <span className="font-semibold">{value}</span>
              {selectedStock?.name && (
                <span className="text-theme-tertiary ml-1.5 text-sm font-normal">
                  {selectedStock.name}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        {value ? (
          <X
            className="w-4 h-4 text-theme-tertiary hover:text-theme-primary flex-shrink-0 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setSearch('');
            }}
          />
        ) : (
          <ChevronDown className={cn('w-4 h-4 text-theme-tertiary flex-shrink-0 transition-transform duration-200', isOpen && 'rotate-180')} />
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden animate-slide-down',
            theme === 'dark' ? 'bg-surface-800 border-surface-700' : 'bg-white border-surface-200'
          )}
        >
          <div className="p-2 border-b" style={{ borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-tertiary" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to search..."
                className={cn(
                  'w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none',
                  theme === 'dark' ? 'bg-surface-900 text-theme-primary placeholder:text-surface-500' : 'bg-surface-50 text-theme-primary placeholder:text-surface-400'
                )}
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary-500 animate-spin" />
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    <span className="text-sm text-theme-tertiary">Searching...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-theme-tertiary" />
                    <span className="text-sm text-theme-tertiary">No stocks found</span>
                  </div>
                )}
              </div>
            ) : (
              filtered.map((stock, idx) => (
                <button
                  key={stock.id}
                  type="button"
                  onClick={() => {
                    onChange(stock.symbol);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    stock.symbol === value
                      ? theme === 'dark'
                        ? 'bg-primary-500/10'
                        : 'bg-primary-50'
                      : idx === highlightIdx
                      ? theme === 'dark'
                        ? 'bg-surface-700'
                        : 'bg-surface-50'
                      : theme === 'dark'
                      ? 'hover:bg-surface-700'
                      : 'hover:bg-surface-50'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                    stock.symbol === value
                      ? 'bg-primary-500/20 text-primary-500'
                      : theme === 'dark' ? 'bg-surface-700 text-primary-400' : 'bg-primary-50 text-primary-600'
                  )}>
                    {stock.symbol.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-theme-primary text-sm">{stock.symbol}</span>
                      {stock.exchange && (
                        <span className="text-xs text-theme-tertiary">{stock.exchange}</span>
                      )}
                      {stock.symbol === value && (
                        <span className="text-xs text-primary-500">✓</span>
                      )}
                    </div>
                    <div className="text-xs text-theme-tertiary truncate">
                      {stock.name || 'Unknown'}
                      {stock.sector && <span className="ml-1">· {stock.sector}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {filtered.length > 0 && (
            <div className={cn(
              "px-4 py-2 text-xs text-theme-tertiary border-t",
              theme === 'dark' ? "border-surface-700 bg-surface-800/50" : "border-surface-200 bg-surface-50"
            )}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} • ↑↓ to navigate • Enter to select
            </div>
          )}
        </div>
      )}
    </div>
  );
}
