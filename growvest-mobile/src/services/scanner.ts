import {OHLCVData, fetchHistoricalData} from './yahoo';
import {ALL_STRATEGIES, StrategyResult, StrategyInfo} from './strategies';
import {NSE_STOCKS, StockInfo} from './stocks';

export interface ScanResultItem {
  symbol: string;
  stockName: string;
  strategy: string;
  strategyDisplayName: string;
  signal: string;
  score: number;
  currentPrice: number;
  resultData: Record<string, any>;
}

export interface ScanRecord {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  strategies: string[];
  totalStocks: number;
  matchedStocks: number;
  results: ScanResultItem[];
  createdAt: string;
  executionTimeMs: number;
}

export async function runScan(
  strategyNames: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ScanRecord> {
  const startTime = Date.now();
  const scanId = `scan_${startTime}_${Math.random().toString(36).slice(2, 8)}`;
  const activeStocks = NSE_STOCKS.filter(s => s.isActive);
  const selectedStrategies = ALL_STRATEGIES.filter(s => strategyNames.includes(s.info.name));

  const results: ScanResultItem[] = [];
  let done = 0;

  const concurrency = 5;
  for (let i = 0; i < activeStocks.length; i += concurrency) {
    const batch = activeStocks.slice(i, i + concurrency);
    const promises = batch.map(async (stock) => {
      try {
        // Fetch ~5 years to cover AVWAP anchor date (2020-03-22) and 52-week strategies
        const data = await fetchHistoricalData(stock.symbol, 1825);
        if (data.length < 30) return;

        for (const strat of selectedStrategies) {
          try {
            const result = strat.execute(data, stock.symbol);
            if (result.matched) {
              results.push({
                symbol: stock.symbol,
                stockName: stock.name,
                strategy: strat.info.name,
                strategyDisplayName: strat.info.displayName,
                signal: result.signal,
                score: Math.round(result.score * 100) / 100,
                currentPrice: result.currentPrice,
                resultData: result.resultData,
              });
            }
          } catch {}
        }
      } catch {}
      done++;
      onProgress?.(done, activeStocks.length);
    });
    await Promise.all(promises);
  }

  results.sort((a, b) => b.score - a.score);

  const stratNames = selectedStrategies.map(s => s.info.displayName).join(', ');
  return {
    id: scanId,
    name: `Scan — ${stratNames.slice(0, 50)}${stratNames.length > 50 ? '...' : ''}`,
    status: 'completed',
    strategies: strategyNames,
    totalStocks: activeStocks.length,
    matchedStocks: new Set(results.map(r => r.symbol)).size,
    results,
    createdAt: new Date().toISOString(),
    executionTimeMs: Date.now() - startTime,
  };
}
