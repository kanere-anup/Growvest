// Direct Yahoo Finance v8 API calls from the phone — no backend needed

export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high52w: number;
  low52w: number;
  volume: number;
  name: string;
}

export async function fetchHistoricalData(
  symbol: string,
  days: number = 365,
): Promise<OHLCVData[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;
  const yahooSymbol = `${symbol}.NS`;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${from}&period2=${now}&interval=1d&events=history`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error('No data returned from Yahoo Finance');
  }

  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];
  if (!quotes || timestamps.length === 0) {
    return [];
  }

  const points: OHLCVData[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quotes.open?.[i];
    const h = quotes.high?.[i];
    const l = quotes.low?.[i];
    const c = quotes.close?.[i];
    const v = quotes.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;

    const date = new Date(timestamps[i] * 1000);
    points.push({
      date: date.toISOString().slice(0, 10),
      open: Number(o.toFixed(2)),
      high: Number(h.toFixed(2)),
      low: Number(l.toFixed(2)),
      close: Number(c.toFixed(2)),
      volume: v || 0,
    });
  }

  return points;
}

export async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  const yahooSymbol = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=1d&interval=1d`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    return {
      symbol,
      price: meta.regularMarketPrice || 0,
      change: (meta.regularMarketPrice || 0) - (meta.chartPreviousClose || 0),
      changePercent:
        meta.chartPreviousClose > 0
          ? (((meta.regularMarketPrice || 0) - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
          : 0,
      high52w: meta.fiftyTwoWeekHigh || 0,
      low52w: meta.fiftyTwoWeekLow || 0,
      volume: meta.regularMarketVolume || 0,
      name: meta.longName || meta.shortName || symbol,
    };
  } catch {
    return null;
  }
}

export async function fetchMultipleQuotes(
  symbols: string[],
  concurrency: number = 5,
): Promise<Map<string, QuoteData>> {
  const results = new Map<string, QuoteData>();

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const promises = batch.map(async sym => {
      const quote = await fetchQuote(sym);
      if (quote) results.set(sym, quote);
    });
    await Promise.all(promises);
  }

  return results;
}
