package marketdata

import (
	"compress/gzip"
	"compress/zlib"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"strings"
	"sync"
	"time"

	"github.com/growvest/stock-screener/pkg/logger"
)

// StockQuote represents stock price data
type StockQuote struct {
	Symbol           string    `json:"symbol"`
	Open             float64   `json:"open"`
	High             float64   `json:"high"`
	Low              float64   `json:"low"`
	Close            float64   `json:"close"`
	LTP              float64   `json:"ltp"` // Last Traded Price
	PreviousClose    float64   `json:"previous_close"`
	Change           float64   `json:"change"`
	ChangePercent    float64   `json:"change_percent"`
	Volume           int64     `json:"volume"`
	TotalBuyQty      int64     `json:"total_buy_qty"`
	TotalSellQty     int64     `json:"total_sell_qty"`
	High52Week       float64   `json:"high_52_week"`
	Low52Week        float64   `json:"low_52_week"`
	TotalTradedValue float64   `json:"total_traded_value"`
	VWAP             float64   `json:"vwap"` // Volume Weighted Average Price
	Timestamp        time.Time `json:"timestamp"`
}

// HistoricalData represents OHLCV data for a single day
type HistoricalData struct {
	Date   time.Time `json:"date"`
	Open   float64   `json:"open"`
	High   float64   `json:"high"`
	Low    float64   `json:"low"`
	Close  float64   `json:"close"`
	Volume int64     `json:"volume"`
}

// MarketDataProvider defines the interface for market data sources
type MarketDataProvider interface {
	// GetQuote fetches current quote for a symbol
	GetQuote(ctx context.Context, symbol string) (*StockQuote, error)

	// GetQuotes fetches current quotes for multiple symbols
	GetQuotes(ctx context.Context, symbols []string) (map[string]*StockQuote, error)

	// GetHistoricalData fetches historical OHLCV data
	GetHistoricalData(ctx context.Context, symbol string, from, to time.Time) ([]HistoricalData, error)

	// GetNifty50List fetches current Nifty 50 constituents
	GetNifty50List(ctx context.Context) ([]string, error)

	// IsMarketOpen checks if market is currently open
	IsMarketOpen(ctx context.Context) bool
}

// NSEService implements MarketDataProvider for NSE India
type NSEService struct {
	client        *http.Client
	baseURL       string
	logger        *logger.Logger
	cache         *QuoteCache
	sessionMu     sync.Mutex
	sessionCookie bool
	lastRequest   time.Time
	requestDelay  time.Duration
}

// QuoteCache caches stock quotes with TTL
type QuoteCache struct {
	mu     sync.RWMutex
	quotes map[string]*cachedQuote
	ttl    time.Duration
}

type cachedQuote struct {
	quote     *StockQuote
	expiresAt time.Time
}

// NewNSEService creates a new NSE market data service
func NewNSEService(log *logger.Logger) *NSEService {
	jar, _ := cookiejar.New(nil)

	return &NSEService{
		client: &http.Client{
			Timeout: 30 * time.Second,
			Jar:     jar, // Cookie jar for session management
			Transport: &http.Transport{
				MaxIdleConns:        10,
				MaxIdleConnsPerHost: 5,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  false,
			},
		},
		baseURL: "https://www.nseindia.com",
		logger:  log.WithComponent("nse_service"),
		cache: &QuoteCache{
			quotes: make(map[string]*cachedQuote),
			ttl:    5 * time.Minute,
		},
		requestDelay: 500 * time.Millisecond, // Delay between requests
	}
}

// initSession establishes a session with NSE by visiting the main page
func (s *NSEService) initSession(ctx context.Context) error {
	s.sessionMu.Lock()
	defer s.sessionMu.Unlock()

	// Already have session
	if s.sessionCookie {
		return nil
	}

	s.logger.Debug().Msg("Initializing NSE session")

	req, err := http.NewRequestWithContext(ctx, "GET", s.baseURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create session request: %w", err)
	}

	s.setNSEHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to init session: %w", err)
	}
	defer resp.Body.Close()

	// Drain body to allow connection reuse
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode == http.StatusOK {
		s.sessionCookie = true
		s.logger.Debug().Msg("NSE session initialized successfully")
	}

	return nil
}

// rateLimitWait ensures we don't make requests too frequently
func (s *NSEService) rateLimitWait() {
	s.sessionMu.Lock()
	defer s.sessionMu.Unlock()

	elapsed := time.Since(s.lastRequest)
	if elapsed < s.requestDelay {
		time.Sleep(s.requestDelay - elapsed)
	}
	s.lastRequest = time.Now()
}

// GetQuote fetches current quote for a symbol with retry logic
func (s *NSEService) GetQuote(ctx context.Context, symbol string) (*StockQuote, error) {
	symbol = strings.ToUpper(symbol)

	// Check cache first
	if quote := s.cache.Get(symbol); quote != nil {
		s.logger.Debug().Str("symbol", symbol).Msg("Quote from cache")
		return quote, nil
	}

	// Ensure session is initialized
	if err := s.initSession(ctx); err != nil {
		s.logger.Warn().Err(err).Msg("Failed to init session, trying anyway")
	}

	// Retry logic with exponential backoff
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(attempt*2) * time.Second
			s.logger.Debug().
				Str("symbol", symbol).
				Int("attempt", attempt+1).
				Dur("backoff", backoff).
				Msg("Retrying quote fetch")
			time.Sleep(backoff)
		}

		quote, err := s.fetchQuote(ctx, symbol)
		if err == nil {
			return quote, nil
		}
		lastErr = err

		// If we get rate limited, reset session
		if strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "rate limit") {
			s.sessionMu.Lock()
			s.sessionCookie = false
			s.sessionMu.Unlock()
		}
	}

	return nil, lastErr
}

// fetchQuote makes the actual API call
func (s *NSEService) fetchQuote(ctx context.Context, symbol string) (*StockQuote, error) {
	// Rate limit
	s.rateLimitWait()

	url := fmt.Sprintf("%s/api/quote-equity?symbol=%s", s.baseURL, symbol)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	s.setNSEHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.Error().Err(err).Str("symbol", symbol).Msg("Failed to fetch quote")
		return nil, fmt.Errorf("failed to fetch quote: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		s.logger.Error().
			Int("status", resp.StatusCode).
			Str("symbol", symbol).
			Str("body", string(body[:min(200, len(body))])).
			Msg("NSE API error")
		return nil, fmt.Errorf("NSE API returned status %d", resp.StatusCode)
	}

	// Handle compressed responses
	reader, err := s.getResponseReader(resp)
	if err != nil {
		return nil, err
	}
	if closer, ok := reader.(io.Closer); ok {
		defer closer.Close()
	}

	// Read body for debugging
	bodyBytes, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check if response looks like JSON
	if len(bodyBytes) == 0 {
		return nil, fmt.Errorf("empty response from NSE")
	}
	if bodyBytes[0] != '{' && bodyBytes[0] != '[' {
		// Not JSON - likely HTML error page
		preview := string(bodyBytes[:min(100, len(bodyBytes))])
		s.logger.Warn().
			Str("symbol", symbol).
			Str("content_type", resp.Header.Get("Content-Type")).
			Str("preview", preview).
			Msg("Non-JSON response from NSE")
		return nil, fmt.Errorf("NSE returned non-JSON response")
	}

	var nseResp NSEQuoteResponse
	if err := json.Unmarshal(bodyBytes, &nseResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	quote := s.parseNSEQuote(&nseResp)
	s.cache.Set(symbol, quote)

	s.logger.Debug().Str("symbol", symbol).Float64("ltp", quote.LTP).Msg("Fetched quote")
	return quote, nil
}

// GetQuotes fetches quotes for multiple symbols SEQUENTIALLY with proper delays
func (s *NSEService) GetQuotes(ctx context.Context, symbols []string) (map[string]*StockQuote, error) {
	results := make(map[string]*StockQuote)
	var errorCount int

	s.logger.Info().Int("count", len(symbols)).Msg("Fetching quotes sequentially")

	for i, symbol := range symbols {
		select {
		case <-ctx.Done():
			return results, ctx.Err()
		default:
		}

		quote, err := s.GetQuote(ctx, symbol)
		if err != nil {
			s.logger.Warn().Err(err).Str("symbol", symbol).Msg("Failed to get quote")
			errorCount++
			continue
		}
		results[symbol] = quote

		// Log progress every 10 stocks
		if (i+1)%10 == 0 {
			s.logger.Info().
				Int("progress", i+1).
				Int("total", len(symbols)).
				Int("success", len(results)).
				Int("failed", errorCount).
				Msg("Quote fetch progress")
		}
	}

	if errorCount > 0 {
		s.logger.Warn().Int("errors", errorCount).Int("total", len(symbols)).Msg("Some quotes failed")
	}

	return results, nil
}

// GetHistoricalData fetches historical OHLCV data using Yahoo Finance API.
// This uses the same underlying API as Python's yfinance library.
// Yahoo Finance handles the full date range in a single call (no chunking needed).
// For NSE stocks, the symbol is converted to Yahoo format: SYMBOL -> SYMBOL.NS
func (s *NSEService) GetHistoricalData(ctx context.Context, symbol string, from, to time.Time) ([]HistoricalData, error) {
	symbol = strings.ToUpper(symbol)

	// Convert to Yahoo Finance symbol format for NSE stocks
	yahooSymbol := symbol + ".NS"

	// Yahoo Finance API uses unix timestamps
	period1 := from.Unix()
	period2 := to.Unix()

	url := fmt.Sprintf(
		"https://query1.finance.yahoo.com/v8/finance/chart/%s?period1=%d&period2=%d&interval=1d&events=history",
		yahooSymbol, period1, period2,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Yahoo Finance headers
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")

	// Use a separate HTTP client for Yahoo (no NSE cookies needed)
	yahooClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := yahooClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch historical data from Yahoo Finance: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Yahoo Finance API returned status %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}

	var yahooResp YahooChartResponse
	if err := json.NewDecoder(resp.Body).Decode(&yahooResp); err != nil {
		return nil, fmt.Errorf("failed to decode Yahoo Finance response: %w", err)
	}

	return s.parseYahooChartData(&yahooResp, symbol)
}

// parseYahooChartData converts Yahoo Finance chart response to HistoricalData slice
func (s *NSEService) parseYahooChartData(resp *YahooChartResponse, symbol string) ([]HistoricalData, error) {
	if resp.Chart.Error != nil {
		return nil, fmt.Errorf("Yahoo Finance error: %s", resp.Chart.Error.Description)
	}

	if len(resp.Chart.Result) == 0 {
		return nil, fmt.Errorf("no data returned from Yahoo Finance for %s", symbol)
	}

	result := resp.Chart.Result[0]
	timestamps := result.Timestamp

	if len(timestamps) == 0 {
		return nil, fmt.Errorf("no timestamps in Yahoo Finance response for %s", symbol)
	}

	if len(result.Indicators.Quote) == 0 {
		return nil, fmt.Errorf("no quote data in Yahoo Finance response for %s", symbol)
	}

	quote := result.Indicators.Quote[0]
	var data []HistoricalData

	for i, ts := range timestamps {
		// Skip entries with nil/zero values (market holidays etc.)
		if i >= len(quote.Open) || i >= len(quote.High) || i >= len(quote.Low) || i >= len(quote.Close) || i >= len(quote.Volume) {
			continue
		}

		// Yahoo returns nil for holidays - skip those
		if quote.Close[i] == nil || quote.Volume[i] == nil {
			continue
		}

		open := derefFloat(quote.Open[i])
		high := derefFloat(quote.High[i])
		low := derefFloat(quote.Low[i])
		closePrice := derefFloat(quote.Close[i])
		volume := derefInt(quote.Volume[i])

		// Skip invalid data points
		if closePrice <= 0 {
			continue
		}

		data = append(data, HistoricalData{
			Date:   time.Unix(ts, 0).UTC(),
			Open:   open,
			High:   high,
			Low:    low,
			Close:  closePrice,
			Volume: volume,
		})
	}

	s.logger.Debug().
		Str("symbol", symbol).
		Int("data_points", len(data)).
		Msg("Yahoo Finance historical data fetched")

	return data, nil
}

// Helper functions for Yahoo Finance nil pointer handling
func derefFloat(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

func derefInt(v *int64) int64 {
	if v == nil {
		return 0
	}
	return *v
}

// GetNifty50List fetches current Nifty 50 constituents
func (s *NSEService) GetNifty50List(ctx context.Context) ([]string, error) {
	if err := s.initSession(ctx); err != nil {
		s.logger.Warn().Err(err).Msg("Failed to init session")
	}

	s.rateLimitWait()

	url := fmt.Sprintf("%s/api/equity-stockIndices?index=NIFTY%%2050", s.baseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	s.setNSEHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch index data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NSE API returned status %d", resp.StatusCode)
	}

	// Handle compressed responses
	reader, err := s.getResponseReader(resp)
	if err != nil {
		return nil, err
	}
	if closer, ok := reader.(io.Closer); ok {
		defer closer.Close()
	}

	var nseResp NSEIndexResponse
	if err := json.NewDecoder(reader).Decode(&nseResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	var symbols []string
	for _, data := range nseResp.Data {
		if data.Symbol != "NIFTY 50" { // Exclude index itself
			symbols = append(symbols, data.Symbol)
		}
	}

	return symbols, nil
}

// IsMarketOpen checks if NSE is currently open
func (s *NSEService) IsMarketOpen(ctx context.Context) bool {
	now := time.Now().In(time.FixedZone("IST", 5*60*60+30*60))
	weekday := now.Weekday()

	// Closed on weekends
	if weekday == time.Saturday || weekday == time.Sunday {
		return false
	}

	// Market hours: 9:15 AM - 3:30 PM IST
	hour := now.Hour()
	minute := now.Minute()
	timeMinutes := hour*60 + minute

	openTime := 9*60 + 15   // 9:15 AM
	closeTime := 15*60 + 30 // 3:30 PM

	return timeMinutes >= openTime && timeMinutes <= closeTime
}

// --- Helper methods ---

// getResponseReader returns appropriate reader based on content encoding
func (s *NSEService) getResponseReader(resp *http.Response) (io.Reader, error) {
	encoding := resp.Header.Get("Content-Encoding")

	switch encoding {
	case "gzip":
		return gzip.NewReader(resp.Body)
	case "deflate":
		return zlib.NewReader(resp.Body)
	case "br":
		// Brotli not supported - this shouldn't happen as we don't request it
		return nil, fmt.Errorf("brotli encoding not supported")
	case "":
		// No compression
		return resp.Body, nil
	default:
		s.logger.Warn().Str("encoding", encoding).Msg("Unknown content encoding")
		return resp.Body, nil
	}
}

func (s *NSEService) setNSEHeaders(req *http.Request) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate") // Don't request brotli - we can't decode it
	req.Header.Set("Referer", "https://www.nseindia.com/get-quotes/equity?symbol=RELIANCE")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("sec-ch-ua", `"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"`)
	req.Header.Set("sec-ch-ua-mobile", "?0")
	req.Header.Set("sec-ch-ua-platform", `"Windows"`)
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
}

func (s *NSEService) parseNSEQuote(resp *NSEQuoteResponse) *StockQuote {
	pd := resp.PriceInfo
	return &StockQuote{
		Symbol:        resp.Info.Symbol,
		Open:          pd.Open,
		High:          pd.IntraDayHighLow.Max,
		Low:           pd.IntraDayHighLow.Min,
		Close:         pd.Close,
		LTP:           pd.LastPrice,
		PreviousClose: pd.PreviousClose,
		Change:        pd.Change,
		ChangePercent: pd.PChange,
		Volume:        resp.PreOpenMarket.TotalTradedVolume,
		High52Week:    pd.WeekHighLow.Max,
		Low52Week:     pd.WeekHighLow.Min,
		VWAP:          pd.VWAP,
		Timestamp:     time.Now(),
	}
}

func (s *NSEService) parseHistoricalData(resp *NSEHistoricalResponse) []HistoricalData {
	var data []HistoricalData
	for _, d := range resp.Data {
		date, _ := time.Parse("02-Jan-2006", d.Date)
		data = append(data, HistoricalData{
			Date:   date,
			Open:   d.Open,
			High:   d.High,
			Low:    d.Low,
			Close:  d.Close,
			Volume: d.Volume,
		})
	}
	return data
}

// --- Cache methods ---

func (c *QuoteCache) Get(symbol string) *StockQuote {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cached, ok := c.quotes[symbol]
	if !ok || time.Now().After(cached.expiresAt) {
		return nil
	}
	return cached.quote
}

func (c *QuoteCache) Set(symbol string, quote *StockQuote) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.quotes[symbol] = &cachedQuote{
		quote:     quote,
		expiresAt: time.Now().Add(c.ttl),
	}
}

// --- NSE API response structures ---

type NSEQuoteResponse struct {
	Info struct {
		Symbol string `json:"symbol"`
		ISIN   string `json:"isin"`
	} `json:"info"`
	PriceInfo struct {
		LastPrice       float64 `json:"lastPrice"`
		Open            float64 `json:"open"`
		Close           float64 `json:"close"`
		PreviousClose   float64 `json:"previousClose"`
		Change          float64 `json:"change"`
		PChange         float64 `json:"pChange"`
		VWAP            float64 `json:"vwap"`
		IntraDayHighLow struct {
			Min float64 `json:"min"`
			Max float64 `json:"max"`
		} `json:"intraDayHighLow"`
		WeekHighLow struct {
			Min float64 `json:"min"`
			Max float64 `json:"max"`
		} `json:"weekHighLow"`
	} `json:"priceInfo"`
	PreOpenMarket struct {
		TotalTradedVolume int64 `json:"totalTradedVolume"`
	} `json:"preOpenMarket"`
}

type NSEHistoricalResponse struct {
	Data []struct {
		Date   string  `json:"CH_TIMESTAMP"`
		Open   float64 `json:"CH_OPENING_PRICE"`
		High   float64 `json:"CH_TRADE_HIGH_PRICE"`
		Low    float64 `json:"CH_TRADE_LOW_PRICE"`
		Close  float64 `json:"CH_CLOSING_PRICE"`
		Volume int64   `json:"CH_TOT_TRADED_QTY"`
	} `json:"data"`
}

type NSEIndexResponse struct {
	Data []struct {
		Symbol string `json:"symbol"`
	} `json:"data"`
}

// --- Yahoo Finance API response structures ---

// YahooChartResponse represents the response from Yahoo Finance v8 chart API
// This is the same API that Python's yfinance library uses
type YahooChartResponse struct {
	Chart struct {
		Result []struct {
			Timestamp  []int64 `json:"timestamp"`
			Indicators struct {
				Quote []struct {
					Open   []*float64 `json:"open"`
					High   []*float64 `json:"high"`
					Low    []*float64 `json:"low"`
					Close  []*float64 `json:"close"`
					Volume []*int64   `json:"volume"`
				} `json:"quote"`
				AdjClose []struct {
					AdjClose []*float64 `json:"adjclose"`
				} `json:"adjclose"`
			} `json:"indicators"`
		} `json:"result"`
		Error *struct {
			Code        string `json:"code"`
			Description string `json:"description"`
		} `json:"error"`
	} `json:"chart"`
}
