package stocksync

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
	"github.com/growvest/stock-screener/pkg/logger"
)

// StockSyncService fetches comprehensive NSE stock list and syncs to DB
type StockSyncService struct {
	stockRepo *repository.StockRepository
	logger    *logger.Logger
	mu        sync.Mutex
	running   bool
}

// NewStockSyncService creates a new stock sync service
func NewStockSyncService(stockRepo *repository.StockRepository, log *logger.Logger) *StockSyncService {
	return &StockSyncService{
		stockRepo: stockRepo,
		logger:    log.WithComponent("stock_sync"),
	}
}

// NSEStockInfo represents enriched stock data
type NSEStockInfo struct {
	Symbol       string  `json:"symbol"`
	Name         string  `json:"name"`
	Sector       string  `json:"sector"`
	Industry     string  `json:"industry"`
	MarketCap    float64 `json:"market_cap"`
	Exchange     string  `json:"exchange"`
	IsTrading    bool    `json:"is_trading"`
	FiftyTwoHigh float64 `json:"fifty_two_high"`
	FiftyTwoLow  float64 `json:"fifty_two_low"`
	LastPrice    float64 `json:"last_price"`
	Volume       int64   `json:"volume"`
}

// SyncResult contains the result of a sync operation
type SyncResult struct {
	TotalFetched int      `json:"total_fetched"`
	NewStocks    int      `json:"new_stocks"`
	Updated      int      `json:"updated"`
	Delisted     int      `json:"delisted"`
	Enriched     int      `json:"enriched"`
	Errors       int      `json:"errors"`
	Duration     string   `json:"duration"`
	ErrorDetails []string `json:"error_details,omitempty"`
}

// SyncAll fetches all NSE stocks and syncs to database
func (s *StockSyncService) SyncAll(ctx context.Context) (*SyncResult, error) {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return nil, fmt.Errorf("sync already in progress")
	}
	s.running = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	start := time.Now()
	s.logger.Info().Msg("Starting stock sync...")

	result := &SyncResult{}

	// Step 1: Build the master symbol list with sector data
	allStocks := s.buildSymbolList()
	result.TotalFetched = len(allStocks)
	s.logger.Info().Int("symbols", len(allStocks)).Msg("Built symbol list from index constituents")

	// Step 2: Enrich with Yahoo Finance v8 chart API (price, name, 52w range)
	s.enrichWithYahooV8(ctx, allStocks, result)
	s.logger.Info().Int("enriched", result.Enriched).Msg("Yahoo Finance v8 enrichment complete")

	// Step 3: Get ALL existing stocks from DB for comparison
	existingStocks, err := s.stockRepo.GetAllStocks(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing stocks: %w", err)
	}

	existingMap := make(map[string]*models.Stock)
	for i := range existingStocks {
		existingMap[existingStocks[i].Symbol] = &existingStocks[i]
	}

	fetchedSymbols := make(map[string]bool)

	// Step 4: Upsert all fetched stocks
	for sym, info := range allStocks {
		fetchedSymbols[sym] = true

		meta := make(map[string]interface{})
		if info.Industry != "" {
			meta["industry"] = info.Industry
		}
		if info.FiftyTwoHigh > 0 {
			meta["52w_high"] = info.FiftyTwoHigh
		}
		if info.FiftyTwoLow > 0 {
			meta["52w_low"] = info.FiftyTwoLow
		}
		if info.LastPrice > 0 {
			meta["last_price"] = info.LastPrice
		}
		if info.Volume > 0 {
			meta["volume"] = info.Volume
		}
		meta["last_synced"] = time.Now().Format(time.RFC3339)

		// Preserve existing metadata fields
		if existing, exists := existingMap[sym]; exists && existing.Metadata != nil {
			for k, v := range existing.Metadata {
				if _, overwritten := meta[k]; !overwritten {
					meta[k] = v
				}
			}
			delete(meta, "possibly_delisted")
			delete(meta, "delisted_check_date")
		}

		name := info.Name
		if name == "" {
			if existing, exists := existingMap[sym]; exists && existing.Name != "" {
				name = existing.Name
			} else {
				name = sym
			}
		}

		sector := info.Sector
		if sector == "" {
			if existing, exists := existingMap[sym]; exists && existing.Sector != "" {
				sector = existing.Sector
			}
		}

		stock := &models.Stock{
			Symbol:    sym,
			Exchange:  "NSE",
			Name:      name,
			Sector:    sector,
			MarketCap: info.MarketCap,
			IsActive:  true,
			Metadata:  meta,
		}

		if err := s.stockRepo.Upsert(ctx, stock); err != nil {
			result.Errors++
			result.ErrorDetails = append(result.ErrorDetails, fmt.Sprintf("%s: %v", sym, err))
			s.logger.Warn().Err(err).Str("symbol", sym).Msg("Failed to upsert stock")
		} else {
			if _, exists := existingMap[sym]; exists {
				result.Updated++
			} else {
				result.NewStocks++
			}
		}
	}

	// Step 5: Mark stocks not in fetched list as potentially delisted
	for symbol, existing := range existingMap {
		if !fetchedSymbols[symbol] && existing.IsActive {
			meta := existing.Metadata
			if meta == nil {
				meta = make(map[string]interface{})
			}
			meta["possibly_delisted"] = true
			meta["delisted_check_date"] = time.Now().Format(time.RFC3339)
			existing.Metadata = meta
			if err := s.stockRepo.Update(ctx, existing); err != nil {
				result.Errors++
			} else {
				result.Delisted++
			}
		}
	}

	result.Duration = time.Since(start).String()

	s.logger.Info().
		Int("total", result.TotalFetched).
		Int("new", result.NewStocks).
		Int("updated", result.Updated).
		Int("enriched", result.Enriched).
		Int("delisted", result.Delisted).
		Int("errors", result.Errors).
		Str("duration", result.Duration).
		Msg("Stock sync completed")

	return result, nil
}

// enrichWithYahooV8 fetches stock data using Yahoo Finance v8 chart API
// This API is reliable and doesn't require authentication.
// It returns: name, regularMarketPrice, fiftyTwoWeekHigh, fiftyTwoWeekLow, volume
func (s *StockSyncService) enrichWithYahooV8(ctx context.Context, stocks map[string]NSEStockInfo, result *SyncResult) {
	client := &http.Client{Timeout: 15 * time.Second}
	symbols := make([]string, 0, len(stocks))
	for sym := range stocks {
		symbols = append(symbols, sym)
	}

	// Process concurrently with a semaphore to limit connections
	type enrichResult struct {
		symbol string
		info   NSEStockInfo
		err    error
	}

	sem := make(chan struct{}, 5) // 5 concurrent requests
	results := make(chan enrichResult, len(symbols))
	var wg sync.WaitGroup

	for _, sym := range symbols {
		if ctx.Err() != nil {
			break
		}

		wg.Add(1)
		go func(symbol string) {
			defer wg.Done()

			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			info, err := s.fetchYahooV8Single(ctx, client, symbol)
			results <- enrichResult{symbol: symbol, info: info, err: err}
		}(sym)
	}

	// Close results channel when all goroutines finish
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	processed := 0
	for r := range results {
		processed++
		if processed%20 == 0 {
			s.logger.Debug().Int("processed", processed).Int("total", len(symbols)).Msg("Enrichment progress")
		}

		if r.err != nil {
			s.logger.Debug().Str("symbol", r.symbol).Err(r.err).Msg("Failed to enrich")
			continue
		}

		existing := stocks[r.symbol]
		if r.info.Name != "" {
			existing.Name = r.info.Name
		}
		if r.info.LastPrice > 0 {
			existing.LastPrice = r.info.LastPrice
			existing.IsTrading = true
		}
		if r.info.FiftyTwoHigh > 0 {
			existing.FiftyTwoHigh = r.info.FiftyTwoHigh
		}
		if r.info.FiftyTwoLow > 0 {
			existing.FiftyTwoLow = r.info.FiftyTwoLow
		}
		if r.info.Volume > 0 {
			existing.Volume = r.info.Volume
		}
		stocks[r.symbol] = existing
		result.Enriched++
	}
}

// fetchYahooV8Single fetches a single stock's data using v8 chart API
func (s *StockSyncService) fetchYahooV8Single(ctx context.Context, client *http.Client, symbol string) (NSEStockInfo, error) {
	yahooSymbol := url.PathEscape(symbol + ".NS")
	apiURL := fmt.Sprintf(
		"https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=1d&range=1d",
		yahooSymbol,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return NSEStockInfo{}, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return NSEStockInfo{}, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return NSEStockInfo{}, fmt.Errorf("status %d: %s", resp.StatusCode, string(body[:min(150, len(body))]))
	}

	var chartResp YahooV8ChartResponse
	if err := json.NewDecoder(resp.Body).Decode(&chartResp); err != nil {
		return NSEStockInfo{}, fmt.Errorf("decode failed: %w", err)
	}

	if chartResp.Chart.Error != nil {
		return NSEStockInfo{}, fmt.Errorf("api error: %v", chartResp.Chart.Error)
	}

	if len(chartResp.Chart.Result) == 0 {
		return NSEStockInfo{}, fmt.Errorf("no result")
	}

	meta := chartResp.Chart.Result[0].Meta
	name := meta.LongName
	if name == "" {
		name = meta.ShortName
	}

	return NSEStockInfo{
		Symbol:       symbol,
		Name:         name,
		Exchange:     "NSE",
		IsTrading:    meta.RegularMarketPrice > 0,
		LastPrice:    meta.RegularMarketPrice,
		FiftyTwoHigh: meta.FiftyTwoWeekHigh,
		FiftyTwoLow:  meta.FiftyTwoWeekLow,
		Volume:       meta.RegularMarketVolume,
	}, nil
}

// buildSymbolList creates a deduplicated map of all NSE index symbols with sector data
func (s *StockSyncService) buildSymbolList() map[string]NSEStockInfo {
	allStocks := make(map[string]NSEStockInfo)

	indices := []struct {
		name    string
		symbols []string
	}{
		{"nifty50", nifty50Symbols},
		{"nifty_next50", niftyNext50Symbols},
		{"nifty_midcap100", niftyMidcap100Symbols},
	}

	for _, idx := range indices {
		for _, sym := range idx.symbols {
			if _, exists := allStocks[sym]; exists {
				continue
			}
			info := NSEStockInfo{
				Symbol:    sym,
				Exchange:  "NSE",
				IsTrading: true,
			}
			// Apply sector from static mapping
			if sector, ok := sectorMap[sym]; ok {
				info.Sector = sector
			}
			if industry, ok := industryMap[sym]; ok {
				info.Industry = industry
			}
			allStocks[sym] = info
		}
	}

	return allStocks
}

// IsRunning returns whether a sync is currently running
func (s *StockSyncService) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// --- Yahoo Finance v8 chart API response types ---

type YahooV8ChartResponse struct {
	Chart struct {
		Result []struct {
			Meta YahooV8Meta `json:"meta"`
		} `json:"result"`
		Error interface{} `json:"error"`
	} `json:"chart"`
}

type YahooV8Meta struct {
	Currency             string  `json:"currency"`
	Symbol               string  `json:"symbol"`
	ExchangeName         string  `json:"exchangeName"`
	FullExchangeName     string  `json:"fullExchangeName"`
	InstrumentType       string  `json:"instrumentType"`
	RegularMarketPrice   float64 `json:"regularMarketPrice"`
	FiftyTwoWeekHigh     float64 `json:"fiftyTwoWeekHigh"`
	FiftyTwoWeekLow      float64 `json:"fiftyTwoWeekLow"`
	RegularMarketDayHigh float64 `json:"regularMarketDayHigh"`
	RegularMarketDayLow  float64 `json:"regularMarketDayLow"`
	RegularMarketVolume  int64   `json:"regularMarketVolume"`
	LongName             string  `json:"longName"`
	ShortName            string  `json:"shortName"`
	ChartPreviousClose   float64 `json:"chartPreviousClose"`
}

// --- Stock Universe: Nifty 50, Next 50, Midcap 100 ---

var nifty50Symbols = []string{
	"RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR",
	"ICICIBANK", "KOTAKBANK", "BHARTIARTL", "ITC", "SBIN",
	"LT", "AXISBANK", "MARUTI", "BAJFINANCE", "HCLTECH",
	"WIPRO", "ULTRACEMCO", "ADANIPORTS", "ONGC", "TATAMOTORS",
	"SUNPHARMA", "JSWSTEEL", "TATASTEEL", "POWERGRID", "NTPC",
	"TECHM", "TITAN", "NESTLEIND", "COALINDIA", "BAJAJFINSV",
	"M&M", "HDFCLIFE", "GRASIM", "DRREDDY", "BRITANNIA",
	"EICHERMOT", "BPCL", "CIPLA", "DIVISLAB", "HEROMOTOCO",
	"BAJAJ-AUTO", "TATACONSUM", "INDUSINDBK", "APOLLOHOSP", "LTIM",
	"ADANIENT", "HINDALCO", "SHRIRAMFIN", "ASIANPAINT", "SBILIFE",
}

var niftyNext50Symbols = []string{
	"ABBOTINDIA", "ADANIGREEN", "ADANIPOWER", "AMBUJACEM", "ATGL",
	"BANKBARODA", "BEL", "BERGEPAINT", "BOSCHLTD", "CANBK",
	"CHOLAFIN", "COLPAL", "DABUR", "DLF", "GAIL",
	"GODREJCP", "HAL", "HAVELLS", "HINDPETRO", "ICICIGI",
	"ICICIPRULI", "IGL", "IOC", "IRCTC", "JIOFIN",
	"JSWENERGY", "LICI", "LUPIN", "MARICO", "MCDOWELL-N",
	"MOTHERSON", "MUTHOOTFIN", "NAUKRI", "NHPC", "OBEROIRLTY",
	"OFSS", "PAGEIND", "PFC", "PIDILITIND", "PNB",
	"POLYCAB", "RECLTD", "SBICARD", "SIEMENS", "SRF",
	"TATAELXSI", "TORNTPHARM", "TRENT", "VEDL", "ZOMATO",
}

var niftyMidcap100Symbols = []string{
	"AUROPHARMA", "BALKRISIND", "BATAINDIA", "BHEL", "BIOCON",
	"CANFINHOME", "CONCOR", "COROMANDEL", "CROMPTON", "CUB",
	"CUMMINSIND", "DEEPAKNTR", "DELHIVERY", "DIXON", "EMAMILTD",
	"ESCORTS", "EXIDEIND", "FEDERALBNK", "FORTIS", "GMRINFRA",
	"GNFC", "GODREJPROP", "GSPL", "IDBI", "IDEA",
	"IDFCFIRSTB", "INDHOTEL", "INDUSTOWER", "IRFC", "JINDALSTEL",
	"JUBLFOOD", "KALYANKJIL", "KEI", "L&TFH", "LAURUSLABS",
	"LICHSGFIN", "LTTS", "MANAPPURAM", "MFSL", "MGL",
	"MOTHERSON", "MPHASIS", "MRF", "NAM-INDIA", "NATIONALUM",
	"NAVINFLUOR", "NMDC", "PERSISTENT", "PETRONET", "PIIND",
	"PRESTIGE", "PVRINOX", "RAMCOCEM", "RATNAMANI", "SAIL",
	"SONACOMS", "STARHEALTH", "SUNDARMFIN", "SUPREMEIND", "SYNGENE",
	"TATACHEM", "TATACOMM", "TATAPOWER", "THERMAX", "TIINDIA",
	"TIMKEN", "TORNTPOWER", "TVSMOTOR", "UBL", "UNIONBANK",
	"UPL", "VOLTAS", "WHIRLPOOL", "ZEEL", "ZYDUSLIFE",
}

// --- Sector & Industry mappings for NSE stocks ---
// (Yahoo v8 chart API doesn't return sector/industry, so we use a static mapping)

var sectorMap = map[string]string{
	// Nifty 50
	"RELIANCE": "Energy", "TCS": "IT", "HDFCBANK": "Banking", "INFY": "IT", "HINDUNILVR": "FMCG",
	"ICICIBANK": "Banking", "KOTAKBANK": "Banking", "BHARTIARTL": "Telecom", "ITC": "FMCG", "SBIN": "Banking",
	"LT": "Infrastructure", "AXISBANK": "Banking", "MARUTI": "Automobile", "BAJFINANCE": "Finance", "HCLTECH": "IT",
	"WIPRO": "IT", "ULTRACEMCO": "Cement", "ADANIPORTS": "Infrastructure", "ONGC": "Energy", "TATAMOTORS": "Automobile",
	"SUNPHARMA": "Pharma", "JSWSTEEL": "Metals", "TATASTEEL": "Metals", "POWERGRID": "Power", "NTPC": "Power",
	"TECHM": "IT", "TITAN": "Consumer Durables", "NESTLEIND": "FMCG", "COALINDIA": "Mining", "BAJAJFINSV": "Finance",
	"M&M": "Automobile", "HDFCLIFE": "Insurance", "GRASIM": "Cement", "DRREDDY": "Pharma", "BRITANNIA": "FMCG",
	"EICHERMOT": "Automobile", "BPCL": "Energy", "CIPLA": "Pharma", "DIVISLAB": "Pharma", "HEROMOTOCO": "Automobile",
	"BAJAJ-AUTO": "Automobile", "TATACONSUM": "FMCG", "INDUSINDBK": "Banking", "APOLLOHOSP": "Healthcare", "LTIM": "IT",
	"ADANIENT": "Infrastructure", "HINDALCO": "Metals", "SHRIRAMFIN": "Finance", "ASIANPAINT": "Consumer Durables", "SBILIFE": "Insurance",
	// Nifty Next 50
	"ABBOTINDIA": "Healthcare", "ADANIGREEN": "Energy", "ADANIPOWER": "Power", "AMBUJACEM": "Cement", "ATGL": "Energy",
	"BANKBARODA": "Banking", "BEL": "Defence", "BERGEPAINT": "Consumer Durables", "BOSCHLTD": "Automobile", "CANBK": "Banking",
	"CHOLAFIN": "Finance", "COLPAL": "FMCG", "DABUR": "FMCG", "DLF": "Real Estate", "GAIL": "Energy",
	"GODREJCP": "FMCG", "HAL": "Defence", "HAVELLS": "Consumer Durables", "HINDPETRO": "Energy", "ICICIGI": "Insurance",
	"ICICIPRULI": "Insurance", "IGL": "Energy", "IOC": "Energy", "IRCTC": "Travel", "JIOFIN": "Finance",
	"JSWENERGY": "Power", "LICI": "Insurance", "LUPIN": "Pharma", "MARICO": "FMCG", "MCDOWELL-N": "FMCG",
	"MOTHERSON": "Automobile", "MUTHOOTFIN": "Finance", "NAUKRI": "IT", "NHPC": "Power", "OBEROIRLTY": "Real Estate",
	"OFSS": "IT", "PAGEIND": "Textile", "PFC": "Finance", "PIDILITIND": "Chemicals", "PNB": "Banking",
	"POLYCAB": "Consumer Durables", "RECLTD": "Finance", "SBICARD": "Finance", "SIEMENS": "Engineering", "SRF": "Chemicals",
	"TATAELXSI": "IT", "TORNTPHARM": "Pharma", "TRENT": "Retail", "VEDL": "Metals", "ZOMATO": "Internet",
	// Nifty Midcap 100
	"AUROPHARMA": "Pharma", "BALKRISIND": "Automobile", "BATAINDIA": "Consumer Durables", "BHEL": "Engineering", "BIOCON": "Pharma",
	"CANFINHOME": "Finance", "CONCOR": "Logistics", "COROMANDEL": "Chemicals", "CROMPTON": "Consumer Durables", "CUB": "Banking",
	"CUMMINSIND": "Engineering", "DEEPAKNTR": "Chemicals", "DELHIVERY": "Logistics", "DIXON": "Consumer Durables", "EMAMILTD": "FMCG",
	"ESCORTS": "Automobile", "EXIDEIND": "Automobile", "FEDERALBNK": "Banking", "FORTIS": "Healthcare", "GMRINFRA": "Infrastructure",
	"GNFC": "Chemicals", "GODREJPROP": "Real Estate", "GSPL": "Energy", "IDBI": "Banking", "IDEA": "Telecom",
	"IDFCFIRSTB": "Banking", "INDHOTEL": "Hotels", "INDUSTOWER": "Telecom", "IRFC": "Finance", "JINDALSTEL": "Metals",
	"JUBLFOOD": "FMCG", "KALYANKJIL": "Consumer Durables", "KEI": "Consumer Durables", "L&TFH": "Finance", "LAURUSLABS": "Pharma",
	"LICHSGFIN": "Finance", "LTTS": "IT", "MANAPPURAM": "Finance", "MFSL": "Finance", "MGL": "Energy",
	"MPHASIS": "IT", "MRF": "Automobile", "NAM-INDIA": "Finance", "NATIONALUM": "Metals", "NAVINFLUOR": "Chemicals",
	"NMDC": "Mining", "PERSISTENT": "IT", "PETRONET": "Energy", "PIIND": "Chemicals", "PRESTIGE": "Real Estate",
	"PVRINOX": "Entertainment", "RAMCOCEM": "Cement", "RATNAMANI": "Metals", "SAIL": "Metals", "SONACOMS": "Automobile",
	"STARHEALTH": "Insurance", "SUNDARMFIN": "Finance", "SUPREMEIND": "Chemicals", "SYNGENE": "Pharma", "TATACHEM": "Chemicals",
	"TATACOMM": "Telecom", "TATAPOWER": "Power", "THERMAX": "Engineering", "TIINDIA": "Engineering", "TIMKEN": "Engineering",
	"TORNTPOWER": "Power", "TVSMOTOR": "Automobile", "UBL": "FMCG", "UNIONBANK": "Banking", "UPL": "Chemicals",
	"VOLTAS": "Consumer Durables", "WHIRLPOOL": "Consumer Durables", "ZEEL": "Media", "ZYDUSLIFE": "Pharma",
}

var industryMap = map[string]string{
	"RELIANCE": "Oil & Gas Refining", "TCS": "IT Services", "HDFCBANK": "Private Banking", "INFY": "IT Services",
	"HINDUNILVR": "Personal Care", "ICICIBANK": "Private Banking", "KOTAKBANK": "Private Banking", "BHARTIARTL": "Telecom Services",
	"ITC": "Cigarettes & FMCG", "SBIN": "Public Banking", "LT": "EPC & Construction", "AXISBANK": "Private Banking",
	"MARUTI": "Passenger Vehicles", "BAJFINANCE": "Consumer Finance", "HCLTECH": "IT Services", "WIPRO": "IT Services",
	"ULTRACEMCO": "Cement Manufacturing", "ADANIPORTS": "Port Services", "ONGC": "Oil Exploration", "TATAMOTORS": "Passenger & Commercial Vehicles",
	"SUNPHARMA": "Pharma Manufacturing", "JSWSTEEL": "Steel Manufacturing", "TATASTEEL": "Steel Manufacturing", "POWERGRID": "Power Transmission",
	"NTPC": "Power Generation", "TECHM": "IT Services", "TITAN": "Jewellery & Watches", "NESTLEIND": "Packaged Foods",
	"COALINDIA": "Coal Mining", "BAJAJFINSV": "Financial Services", "M&M": "Automotive & Farm Equipment", "HDFCLIFE": "Life Insurance",
	"GRASIM": "Cement & Textiles", "DRREDDY": "Pharma Manufacturing", "BRITANNIA": "Packaged Foods", "EICHERMOT": "Two-Wheelers",
	"BPCL": "Oil Marketing", "CIPLA": "Pharma Manufacturing", "DIVISLAB": "API Manufacturing", "HEROMOTOCO": "Two-Wheelers",
	"BAJAJ-AUTO": "Two & Three-Wheelers", "TATACONSUM": "Packaged Foods & Beverages", "INDUSINDBK": "Private Banking",
	"APOLLOHOSP": "Hospitals", "LTIM": "IT Services", "ADANIENT": "Diversified Conglomerate", "HINDALCO": "Aluminium & Copper",
	"SHRIRAMFIN": "Vehicle Finance", "ASIANPAINT": "Decorative Paints", "SBILIFE": "Life Insurance",
	"HAL": "Aerospace & Defence", "BEL": "Defence Electronics", "ZOMATO": "Food Delivery", "DLF": "Real Estate Development",
	"SIEMENS": "Industrial Automation", "NAUKRI": "Online Recruitment", "TRENT": "Retail Fashion",
}
