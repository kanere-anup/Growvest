import {OHLCVData} from './yahoo';
import {ALL_STRATEGIES, StrategyResult} from './strategies';

export interface Trade {
  date: string;
  type: 'entry' | 'exit';
  price: number;
  signal: string;
  score: number;
  resultData?: Record<string, any>;
}

export interface BacktestResult {
  symbol: string;
  strategy: string;
  strategyDisplayName: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  trades: Trade[];
  equityCurve: number[];
  dates: string[];
}

export function runBacktest(
  data: OHLCVData[],
  strategyName: string,
  symbol: string,
  initialCapital: number,
): BacktestResult | null {
  const stratEntry = ALL_STRATEGIES.find(s => s.info.name === strategyName);
  if (!stratEntry) return null;
  if (data.length < 30) return null;

  let capital = initialCapital;
  let position = 0;
  let entryPrice = 0;
  let peak = initialCapital;
  let maxDrawdown = 0;

  const trades: Trade[] = [];
  const equityCurve: number[] = [];
  const dates: string[] = [];
  const wins: number[] = [];
  const losses: number[] = [];

  const minLookback = 30;
  for (let i = minLookback; i < data.length; i++) {
    const window = data.slice(0, i + 1);
    let res: StrategyResult;
    try {
      res = stratEntry.execute(window, symbol);
    } catch {
      continue;
    }

    const price = data[i].close;
    let portfolioValue = capital;
    if (position > 0) {
      portfolioValue = capital + position * (price - entryPrice);
    }

    equityCurve.push(portfolioValue);
    dates.push(data[i].date);

    if (portfolioValue > peak) peak = portfolioValue;
    const dd = (peak - portfolioValue) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (res.matched && res.signal === 'buy' && position === 0) {
      const shares = Math.floor(capital / price);
      if (shares > 0) {
        position = shares;
        entryPrice = price;
        capital -= shares * price;
        trades.push({date: data[i].date, type: 'entry', price, signal: res.signal, score: res.score, resultData: res.resultData});
      }
    } else if (position > 0 && res.matched && res.signal === 'sell') {
      const pnl = position * (price - entryPrice);
      capital += position * price;
      trades.push({date: data[i].date, type: 'exit', price, signal: res.signal, score: res.score});
      if (pnl > 0) wins.push(pnl);
      else losses.push(pnl);
      position = 0;
      entryPrice = 0;
    }
  }

  if (position > 0) {
    const lastPrice = data[data.length - 1].close;
    const pnl = position * (lastPrice - entryPrice);
    capital += position * lastPrice;
    trades.push({date: data[data.length - 1].date, type: 'exit', price: lastPrice, signal: 'close', score: 0});
    if (pnl > 0) wins.push(pnl);
    else losses.push(pnl);
  }

  const totalTrades = wins.length + losses.length;
  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

  const dayMs = 86400000;
  const startMs = new Date(data[0].date).getTime();
  const endMs = new Date(data[data.length - 1].date).getTime();
  const years = (endMs - startMs) / (dayMs * 365.25);

  let annualReturn = 0;
  if (years > 0) {
    annualReturn = (Math.pow(capital / initialCapital, 1 / years) - 1) * 100;
  }

  let sharpeRatio = 0;
  if (equityCurve.length > 1) {
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      dailyReturns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }
    const avg = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, v) => s + (v - avg) ** 2, 0) / (dailyReturns.length - 1);
    const sd = Math.sqrt(variance);
    if (sd > 0) sharpeRatio = (avg / sd) * Math.sqrt(252);
  }

  return {
    symbol,
    strategy: strategyName,
    strategyDisplayName: stratEntry.info.displayName,
    startDate: data[0].date,
    endDate: data[data.length - 1].date,
    initialCapital,
    finalCapital: capital,
    totalReturn: ((capital - initialCapital) / initialCapital) * 100,
    annualReturn,
    maxDrawdown: maxDrawdown * 100,
    sharpeRatio,
    winRate: totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0,
    totalTrades,
    winningTrades: wins.length,
    losingTrades: losses.length,
    avgWin,
    avgLoss,
    profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0,
    trades,
    equityCurve,
    dates,
  };
}
