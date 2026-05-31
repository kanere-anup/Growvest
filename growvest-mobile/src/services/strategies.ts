// All 11 strategies ported from Go to TypeScript — runs entirely on the phone

import {OHLCVData} from './yahoo';

export interface StrategyResult {
  symbol: string;
  currentPrice: number;
  score: number;
  signal: 'buy' | 'sell' | 'hold' | 'neutral';
  matched: boolean;
  resultData: Record<string, any>;
}

export interface StrategyInfo {
  name: string;
  displayName: string;
  description: string;
  category: string;
  isEnabled: boolean;
}

export type StrategyFn = (data: OHLCVData[], symbol: string) => StrategyResult;

// ─── Technical Indicator Helpers ───

function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const ema: number[] = [];
  let sma = 0;
  for (let i = 0; i < period; i++) sma += values[i];
  ema.push(sma / period);
  for (let i = 1; i <= values.length - period; i++) {
    ema.push((values[i + period - 1] - ema[i - 1]) * multiplier + ema[i - 1]);
  }
  return ema;
}

function calculateSMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result.push(sum / period);
  for (let i = 1; i <= values.length - period; i++) {
    sum += values[i + period - 1] - values[i - 1];
    result.push(sum / period);
  }
  return result;
}

function calculateRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return -1;
  let avgGain = 0, avgLoss = 0;
  const start = closes.length - period - 1;
  for (let i = 1; i <= period; i++) {
    const change = closes[start + i] - closes[start + i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const sumSq = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function noMatch(symbol: string): StrategyResult {
  return {symbol, currentPrice: 0, score: 0, signal: 'neutral', matched: false, resultData: {}};
}

// ─── Strategy Implementations ───

function rsiStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const period = 14, overbought = 70, oversold = 30;
  if (data.length < period + 1) return noMatch(symbol);
  const closes = data.map(d => d.close);
  const rsi = calculateRSI(closes, period);
  const price = closes[closes.length - 1];
  if (rsi < 0 || price <= 0) return noMatch(symbol);

  if (rsi <= oversold) {
    return {symbol, currentPrice: price, score: Math.round((1 - rsi / oversold) * 10000) / 100, signal: 'buy', matched: true, resultData: {rsi: Math.round(rsi * 100) / 100, condition: 'Oversold'}};
  }
  if (rsi >= overbought) {
    return {symbol, currentPrice: price, score: Math.round(((rsi - overbought) / (100 - overbought)) * 10000) / 100, signal: 'sell', matched: true, resultData: {rsi: Math.round(rsi * 100) / 100, condition: 'Overbought'}};
  }
  return noMatch(symbol);
}

function macdStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const fastP = 12, slowP = 26, sigP = 9;
  if (data.length < slowP + sigP + 1) return noMatch(symbol);
  const closes = data.map(d => d.close);
  const fastEMA = calculateEMA(closes, fastP);
  const slowEMA = calculateEMA(closes, slowP);
  const macdLine: number[] = [];
  const offset = fastEMA.length - slowEMA.length;
  for (let i = 0; i < slowEMA.length; i++) macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  const signalLine = calculateEMA(macdLine, sigP);
  if (signalLine.length < 2) return noMatch(symbol);

  const mo = macdLine.length - signalLine.length;
  const curMACD = macdLine[mo + signalLine.length - 1];
  const curSig = signalLine[signalLine.length - 1];
  const prevMACD = macdLine[mo + signalLine.length - 2];
  const prevSig = signalLine[signalLine.length - 2];
  const histogram = curMACD - curSig;
  const price = closes[closes.length - 1];

  const bullish = prevMACD <= prevSig && curMACD > curSig;
  const bearish = prevMACD >= prevSig && curMACD < curSig;
  if (!bullish && !bearish) return noMatch(symbol);

  return {
    symbol, currentPrice: price, score: Math.min(Math.abs(histogram) * 1000, 100),
    signal: bullish ? 'buy' : 'sell', matched: true,
    resultData: {macd: +curMACD.toFixed(4), signal_line: +curSig.toFixed(4), histogram: +histogram.toFixed(4), cross_type: bullish ? 'Bullish Crossover' : 'Bearish Crossover'},
  };
}

function emaCrossoverStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const shortP = 9, longP = 21;
  if (data.length < longP + 2) return noMatch(symbol);
  const closes = data.map(d => d.close);
  const shortEMA = calculateEMA(closes, shortP);
  const longSMA = calculateSMA(closes, longP);
  if (shortEMA.length < 2 || longSMA.length < 2) return noMatch(symbol);

  const si = shortEMA.length - 2, li = longSMA.length - 2;
  const curShort = shortEMA[si + 1], prevShort = shortEMA[si];
  const curLong = longSMA[li + 1], prevLong = longSMA[li];
  const golden = prevShort <= prevLong && curShort > curLong;
  const death = prevShort >= prevLong && curShort < curLong;
  if (!golden && !death) return noMatch(symbol);

  const separation = Math.abs(curShort - curLong) / curLong * 100;
  return {
    symbol, currentPrice: closes[closes.length - 1], score: Math.min(separation * 20, 100),
    signal: golden ? 'buy' : 'sell', matched: true,
    resultData: {cross_type: golden ? 'Golden Cross' : 'Death Cross', separation_pct: +separation.toFixed(2)},
  };
}

function bollingerStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const period = 20, stdMult = 2, tolerance = 0.02;
  if (data.length < period) return noMatch(symbol);
  const closes = data.map(d => d.close);
  const recent = closes.slice(-period);
  const sma = mean(recent);
  const sd = stdDev(recent, sma);
  const upper = sma + stdMult * sd;
  const lower = sma - stdMult * sd;
  const price = closes[closes.length - 1];

  if (price <= lower * (1 + tolerance)) {
    const score = Math.min(((lower - price) / lower) * 1000, 100);
    return {symbol, currentPrice: price, score, signal: 'buy', matched: true, resultData: {upper: +upper.toFixed(2), lower: +lower.toFixed(2), sma: +sma.toFixed(2), condition: 'Near Lower Band'}};
  }
  if (price >= upper * (1 - tolerance)) {
    const score = Math.min(((price - upper) / upper) * 1000, 100);
    return {symbol, currentPrice: price, score, signal: 'sell', matched: true, resultData: {upper: +upper.toFixed(2), lower: +lower.toFixed(2), sma: +sma.toFixed(2), condition: 'Near Upper Band'}};
  }
  return noMatch(symbol);
}

function meanReversionStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const period = 20, threshold = 2;
  if (data.length < period) return noMatch(symbol);
  const closes = data.map(d => d.close);
  const recent = closes.slice(-period);
  const avg = mean(recent);
  const sd = stdDev(recent, avg);
  if (sd === 0) return noMatch(symbol);
  const price = closes[closes.length - 1];
  const zScore = (price - avg) / sd;

  if (zScore < -threshold) {
    return {symbol, currentPrice: price, score: Math.min(Math.abs(zScore) * 25, 100), signal: 'buy', matched: true, resultData: {z_score: +zScore.toFixed(2), mean: +avg.toFixed(2), std_dev: +sd.toFixed(2), condition: 'Below Mean'}};
  }
  if (zScore > threshold) {
    return {symbol, currentPrice: price, score: Math.min(zScore * 25, 100), signal: 'sell', matched: true, resultData: {z_score: +zScore.toFixed(2), mean: +avg.toFixed(2), std_dev: +sd.toFixed(2), condition: 'Above Mean'}};
  }
  return noMatch(symbol);
}

function momentumStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  if (data.length < 21) return noMatch(symbol);
  const closes = data.map(d => d.close);
  const price = closes[closes.length - 1];
  const ret5 = (price - closes[closes.length - 6]) / closes[closes.length - 6] * 100;
  const ret10 = (price - closes[closes.length - 11]) / closes[closes.length - 11] * 100;
  const ret20 = (price - closes[closes.length - 21]) / closes[closes.length - 21] * 100;

  if (ret5 > 3 && ret10 > 5 && ret20 > 10) {
    const score = Math.min((ret5 + ret10 + ret20) / 3 * 5, 100);
    return {symbol, currentPrice: price, score, signal: 'buy', matched: true, resultData: {return_5d: +ret5.toFixed(2), return_10d: +ret10.toFixed(2), return_20d: +ret20.toFixed(2)}};
  }
  if (ret5 < -3 && ret10 < -5 && ret20 < -10) {
    const score = Math.min(Math.abs((ret5 + ret10 + ret20) / 3) * 5, 100);
    return {symbol, currentPrice: price, score, signal: 'sell', matched: true, resultData: {return_5d: +ret5.toFixed(2), return_10d: +ret10.toFixed(2), return_20d: +ret20.toFixed(2)}};
  }
  return noMatch(symbol);
}

function obvStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const lookback = 20;
  if (data.length < lookback + 1) return noMatch(symbol);
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume);

  // Calculate OBV
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }

  const recentOBV = obv.slice(-lookback);
  const recentClose = closes.slice(-lookback);
  const obvChange = (recentOBV[recentOBV.length - 1] - recentOBV[0]) / (Math.abs(recentOBV[0]) || 1) * 100;
  const priceChange = (recentClose[recentClose.length - 1] - recentClose[0]) / recentClose[0] * 100;
  const price = closes[closes.length - 1];

  // Bullish divergence: OBV up, price flat/down
  if (obvChange > 5 && priceChange < 0) {
    return {symbol, currentPrice: price, score: Math.min(obvChange * 2, 100), signal: 'buy', matched: true, resultData: {obv_change: +obvChange.toFixed(2), price_change: +priceChange.toFixed(2), divergence: 'Bullish'}};
  }
  // Bearish divergence: OBV down, price flat/up
  if (obvChange < -5 && priceChange > 0) {
    return {symbol, currentPrice: price, score: Math.min(Math.abs(obvChange) * 2, 100), signal: 'sell', matched: true, resultData: {obv_change: +obvChange.toFixed(2), price_change: +priceChange.toFixed(2), divergence: 'Bearish'}};
  }
  return noMatch(symbol);
}

function volumeBreakoutStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const period = 20, multiplier = 2;
  if (data.length < period + 1) return noMatch(symbol);
  const volumes = data.map(d => d.volume);
  const closes = data.map(d => d.close);
  const avgVol = mean(volumes.slice(-period - 1, -1));
  const curVol = volumes[volumes.length - 1];
  const price = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2];

  if (curVol < avgVol * multiplier || curVol < 100000) return noMatch(symbol);

  const volRatio = curVol / avgVol;
  const signal = price > prevPrice ? 'buy' : 'sell';
  return {
    symbol, currentPrice: price, score: Math.min(volRatio * 20, 100),
    signal: signal as 'buy' | 'sell', matched: true,
    resultData: {volume_ratio: +volRatio.toFixed(2), avg_volume: Math.round(avgVol), current_volume: curVol, breakout_type: price > prevPrice ? 'Bullish' : 'Bearish'},
  };
}

function vwapStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const tolerance = 0.02;
  if (data.length < 5) return noMatch(symbol);
  // Use last day's OHLCV for intraday VWAP approximation
  const recent = data.slice(-20);
  let cumPV = 0, cumVol = 0;
  for (const d of recent) {
    const typical = (d.high + d.low + d.close) / 3;
    cumPV += typical * d.volume;
    cumVol += d.volume;
  }
  if (cumVol === 0) return noMatch(symbol);
  const vwap = cumPV / cumVol;
  const price = data[data.length - 1].close;
  const deviation = (price - vwap) / vwap;

  if (Math.abs(deviation) <= tolerance) {
    return {symbol, currentPrice: price, score: Math.round((1 - Math.abs(deviation) / tolerance) * 100), signal: price >= vwap ? 'buy' : 'hold', matched: true, resultData: {vwap: +vwap.toFixed(2), deviation_pct: +(deviation * 100).toFixed(2)}};
  }
  return noMatch(symbol);
}

function week52Strategy(data: OHLCVData[], symbol: string): StrategyResult {
  const threshold = 0.02;
  if (data.length < 252) return noMatch(symbol);
  const closes = data.slice(-252).map(d => d.close);
  const high52 = Math.max(...closes);
  const low52 = Math.min(...closes);
  const price = closes[closes.length - 1];

  if (price >= high52 * (1 - threshold)) {
    return {symbol, currentPrice: price, score: Math.round(((price - high52 * (1 - threshold)) / (high52 * threshold)) * 100), signal: 'buy', matched: true, resultData: {high_52w: +high52.toFixed(2), low_52w: +low52.toFixed(2), proximity: 'Near 52-Week High'}};
  }
  if (price <= low52 * (1 + threshold)) {
    return {symbol, currentPrice: price, score: Math.round(((low52 * (1 + threshold) - price) / (low52 * threshold)) * 100), signal: 'buy', matched: true, resultData: {high_52w: +high52.toFixed(2), low_52w: +low52.toFixed(2), proximity: 'Near 52-Week Low'}};
  }
  return noMatch(symbol);
}

function avwapStrategy(data: OHLCVData[], symbol: string): StrategyResult {
  const tolerance = 0.05;
  const anchorDate = '2020-03-22'; // COVID crash low — matches Go backend
  const minVolume = 100000;

  if (data.length < 20) return noMatch(symbol);

  // Filter data from anchor date onwards (matching Go: data.FilterFromDate)
  const filtered = data.filter(d => d.date >= anchorDate);
  if (filtered.length === 0) return noMatch(symbol);

  // Calculate AVWAP from anchor date to latest
  let cumPV = 0, cumVol = 0;
  for (const d of filtered) {
    const typical = (d.high + d.low + d.close) / 3;
    cumPV += typical * d.volume;
    cumVol += d.volume;
  }
  if (cumVol === 0) return noMatch(symbol);
  const avwap = cumPV / cumVol;

  // Check minimum 20-day average volume
  const tail20 = data.slice(-20);
  const avgVolume = tail20.reduce((s, d) => s + d.volume, 0) / tail20.length;
  if (avgVolume < minVolume) return noMatch(symbol);

  const price = data[data.length - 1].close;
  if (price <= 0) return noMatch(symbol);

  // Price difference from AVWAP as percentage
  const priceDiffPct = ((price - avwap) / avwap) * 100;
  const tolerancePct = tolerance * 100;

  if (Math.abs(priceDiffPct) > tolerancePct) return noMatch(symbol);

  // Score: higher = closer to AVWAP
  const score = Math.round((1 - Math.abs(priceDiffPct) / tolerancePct) * 10000) / 100;

  return {
    symbol, currentPrice: price, score, signal: 'buy', matched: true,
    resultData: {
      avwap: +avwap.toFixed(2),
      difference_pct: +priceDiffPct.toFixed(2),
      volume_avg_20d: Math.round(avgVolume),
      anchor_date: anchorDate,
      data_points_used: filtered.length,
    },
  };
}

// ─── Strategy Registry ───

export const ALL_STRATEGIES: {info: StrategyInfo; execute: StrategyFn}[] = [
  {info: {name: 'rsi', displayName: 'RSI (Relative Strength Index)', description: 'Identifies overbought (>70) and oversold (<30) conditions', category: 'technical', isEnabled: true}, execute: rsiStrategy},
  {info: {name: 'macd', displayName: 'MACD Crossover', description: 'Detects MACD/signal line crossover signals', category: 'technical', isEnabled: true}, execute: macdStrategy},
  {info: {name: 'ema_crossover', displayName: 'EMA/SMA Crossover', description: 'Golden cross and death cross detection', category: 'technical', isEnabled: true}, execute: emaCrossoverStrategy},
  {info: {name: 'bollinger_bands', displayName: 'Bollinger Bands', description: 'Price near upper/lower Bollinger bands', category: 'technical', isEnabled: true}, execute: bollingerStrategy},
  {info: {name: 'mean_reversion', displayName: 'Mean Reversion', description: 'Z-score based mean reversion signals', category: 'statistical', isEnabled: true}, execute: meanReversionStrategy},
  {info: {name: 'momentum', displayName: 'Momentum', description: 'Multi-timeframe momentum across 5/10/20 days', category: 'technical', isEnabled: true}, execute: momentumStrategy},
  {info: {name: 'obv', displayName: 'OBV Divergence', description: 'On-Balance Volume divergence from price', category: 'volume', isEnabled: true}, execute: obvStrategy},
  {info: {name: 'volume_breakout', displayName: 'Volume Breakout', description: 'Unusual volume with price direction', category: 'volume', isEnabled: true}, execute: volumeBreakoutStrategy},
  {info: {name: 'vwap', displayName: 'VWAP Proximity', description: 'Price near Volume Weighted Average Price', category: 'institutional', isEnabled: true}, execute: vwapStrategy},
  {info: {name: 'week_52_extremes', displayName: '52-Week Extremes', description: 'Price near 52-week high or low', category: 'price_action', isEnabled: true}, execute: week52Strategy},
  {info: {name: 'avwap_proximity', displayName: 'Anchored VWAP', description: 'Price near anchored VWAP from historic date', category: 'institutional', isEnabled: true}, execute: avwapStrategy},
];

export function getStrategy(name: string) {
  return ALL_STRATEGIES.find(s => s.info.name === name);
}
