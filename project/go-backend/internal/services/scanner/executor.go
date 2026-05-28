package scanner

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/middleware"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
	"github.com/growvest/stock-screener/internal/services/cache"
	"github.com/growvest/stock-screener/internal/services/marketdata"
	"github.com/growvest/stock-screener/internal/services/strategies"
	"github.com/growvest/stock-screener/internal/services/websocket"
	"github.com/growvest/stock-screener/pkg/logger"
)

// ScanExecutor processes scans in the background
type ScanExecutor struct {
	scanRepo     *repository.ScanRepository
	stockRepo    *repository.StockRepository
	strategyRepo *repository.StrategyRepository
	marketData   *marketdata.NSEService
	registry     *strategies.Registry
	cache        *cache.RedisCache
	wsHub        *websocket.Hub
	logger       *logger.Logger
	scanQueue    chan uuid.UUID
	workerCount  int
	stopCh       chan struct{}
	wg           sync.WaitGroup
}

// Config for scan executor
type ExecutorConfig struct {
	WorkerCount int
	QueueSize   int
}

// NewScanExecutor creates a new scan executor
func NewScanExecutor(
	scanRepo *repository.ScanRepository,
	stockRepo *repository.StockRepository,
	strategyRepo *repository.StrategyRepository,
	marketData *marketdata.NSEService,
	registry *strategies.Registry,
	redisCache *cache.RedisCache,
	wsHub *websocket.Hub,
	log *logger.Logger,
	cfg ExecutorConfig,
) *ScanExecutor {
	if cfg.WorkerCount <= 0 {
		cfg.WorkerCount = 3
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = 100
	}

	return &ScanExecutor{
		scanRepo:     scanRepo,
		stockRepo:    stockRepo,
		strategyRepo: strategyRepo,
		marketData:   marketData,
		registry:     registry,
		cache:        redisCache,
		wsHub:        wsHub,
		logger:       log.WithComponent("scan_executor"),
		scanQueue:    make(chan uuid.UUID, cfg.QueueSize),
		workerCount:  cfg.WorkerCount,
		stopCh:       make(chan struct{}),
	}
}

// Start begins processing scans
func (e *ScanExecutor) Start(ctx context.Context) {
	e.logger.Info().Int("workers", e.workerCount).Msg("Starting scan executor")

	// Start worker goroutines
	for i := 0; i < e.workerCount; i++ {
		e.wg.Add(1)
		go e.worker(ctx, i)
	}

	// Start pending scan checker
	e.wg.Add(1)
	go e.pendingScanChecker(ctx)
}

// Stop gracefully stops the executor
func (e *ScanExecutor) Stop() {
	e.logger.Info().Msg("Stopping scan executor")
	close(e.stopCh)
	e.wg.Wait()
	e.logger.Info().Msg("Scan executor stopped")
}

// EnqueueScan adds a scan to the processing queue
func (e *ScanExecutor) EnqueueScan(scanID uuid.UUID) error {
	select {
	case e.scanQueue <- scanID:
		e.logger.Debug().Str("scan_id", scanID.String()).Msg("Scan enqueued")
		return nil
	default:
		e.logger.Warn().Str("scan_id", scanID.String()).Msg("Scan queue full")
		return ErrQueueFull
	}
}

// worker processes scans from the queue
func (e *ScanExecutor) worker(ctx context.Context, id int) {
	defer e.wg.Done()

	log := e.logger.WithFields(map[string]interface{}{"worker_id": id})
	log.Debug().Msg("Worker started")

	for {
		select {
		case <-ctx.Done():
			return
		case <-e.stopCh:
			return
		case scanID := <-e.scanQueue:
			e.processScan(ctx, scanID, log)
		}
	}
}

// pendingScanChecker periodically checks for pending scans
func (e *ScanExecutor) pendingScanChecker(ctx context.Context) {
	defer e.wg.Done()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-e.stopCh:
			return
		case <-ticker.C:
			e.checkPendingScans(ctx)
		}
	}
}

// checkPendingScans looks for pending/stalled scans
func (e *ScanExecutor) checkPendingScans(ctx context.Context) {
	// Find scans that are pending or running for too long
	pendingScans, err := e.scanRepo.GetPendingScans(ctx, 10)
	if err != nil {
		e.logger.Error().Err(err).Msg("Failed to get pending scans")
		return
	}

	for _, scan := range pendingScans {
		select {
		case e.scanQueue <- scan.ID:
			e.logger.Debug().Str("scan_id", scan.ID.String()).Msg("Re-enqueued pending scan")
		default:
			// Queue full, try again later
		}
	}
}

// processScan executes a single scan
func (e *ScanExecutor) processScan(ctx context.Context, scanID uuid.UUID, log *logger.Logger) {
	startTime := time.Now()
	log = log.WithFields(map[string]interface{}{"scan_id": scanID.String()})
	log.Info().Msg("Processing scan")

	// Get scan details to verify it exists
	_, err := e.scanRepo.GetByIDWithDetails(ctx, scanID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get scan")
		return
	}

	// Update status to running
	_ = e.scanRepo.UpdateStatus(ctx, scanID, models.ScanStatusRunning, nil)
	e.broadcastProgress(scanID, "running", 0, 0, 0, 0, 0, 0)

	// Get stocks for this scan
	stocks, err := e.scanRepo.GetScanStocks(ctx, scanID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get scan stocks")
		e.failScan(ctx, scanID, "Failed to get stocks")
		return
	}

	// Get strategies for this scan
	scanStrategies, err := e.scanRepo.GetScanStrategies(ctx, scanID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get scan strategies")
		e.failScan(ctx, scanID, "Failed to get strategies")
		return
	}

	// Determine the maximum lookback period needed across all strategies
	maxLookbackDays := 60
	for _, scanStrategy := range scanStrategies {
		strategy, ok := e.registry.Get(scanStrategy.UserStrategy.Strategy.Name)
		if !ok {
			continue
		}
		if histNeeder, ok := strategy.(strategies.HistoricalDataNeeder); ok {
			needsData, fromDate := histNeeder.NeedsHistoricalData(scanStrategy.ParametersSnapshot)
			if needsData {
				days := int(time.Since(fromDate).Hours()/24) + 10
				if days > maxLookbackDays {
					maxLookbackDays = days
				}
			}
		}
	}

	// Process each stock with each strategy
	var results []models.ScanResult
	processedCount := 0
	successCount := 0
	failedCount := 0

	for _, stock := range stocks {
		// Fetch historical data via Yahoo Finance (primary data source)
		fromDate := time.Now().AddDate(0, 0, -maxLookbackDays)
		stockData := e.fetchHistoricalStockData(ctx, stock.Symbol, stock.Exchange, fromDate, nil, log)

		if stockData == nil || stockData.Len() < 2 {
			log.Warn().Str("symbol", stock.Symbol).Msg("No market data available from Yahoo Finance")
			failedCount++
			processedCount++

			if processedCount%5 == 0 {
				_ = e.scanRepo.UpdateProgress(ctx, scanID, processedCount, successCount, failedCount)
				e.broadcastProgress(scanID, "running", len(stocks), processedCount, successCount, failedCount, len(results), int(time.Since(startTime).Milliseconds()))
			}
			continue
		}

		currentPrice := stockData.LastClose()

		// Run each strategy on this stock
		for _, scanStrategy := range scanStrategies {
			strategy, ok := e.registry.Get(scanStrategy.UserStrategy.Strategy.Name)
			if !ok {
				log.Warn().Str("strategy", scanStrategy.UserStrategy.Strategy.Name).Msg("Strategy not found in registry")
				continue
			}

			// Execute strategy
			result, err := strategy.Execute(ctx, stockData, scanStrategy.ParametersSnapshot)
			if err != nil {
				log.Debug().Err(err).
					Str("symbol", stock.Symbol).
					Str("strategy", strategy.Name()).
					Msg("Strategy execution failed")
				continue
			}

			if result.Matched && result.Signal != "" && result.Signal != "neutral" {
				middleware.StrategyMatchesTotal.WithLabelValues(strategy.Name(), result.Signal).Inc()
				results = append(results, models.ScanResult{
					ScanID:       scanID,
					StockID:      stock.ID,
					StrategyID:   scanStrategy.UserStrategy.StrategyID,
					Symbol:       stock.Symbol,
					CurrentPrice: currentPrice,
					Score:        result.Score,
					Signal:       result.Signal,
					ResultData:   result.ResultData,
				})
			}
		}

		successCount++
		processedCount++

		// Update progress periodically
		if processedCount%5 == 0 || processedCount == len(stocks) {
			_ = e.scanRepo.UpdateProgress(ctx, scanID, processedCount, successCount, failedCount)
			e.broadcastProgress(scanID, "running", len(stocks), processedCount, successCount, failedCount, len(results), int(time.Since(startTime).Milliseconds()))
		}
	}

	// Save all results
	if len(results) > 0 {
		if err := e.scanRepo.SaveResults(ctx, results); err != nil {
			log.Error().Err(err).Msg("Failed to save results")
		}
	}

	// Mark scan as completed
	executionTime := int(time.Since(startTime).Milliseconds())
	err = e.scanRepo.CompleteScan(ctx, scanID, successCount, failedCount, executionTime)
	if err != nil {
		log.Error().Err(err).Msg("Failed to complete scan")
	}

	e.broadcastProgress(scanID, "completed", len(stocks), processedCount, successCount, failedCount, len(results), executionTime)

	// Record Prometheus metrics
	middleware.ScanExecutionDuration.WithLabelValues("completed").Observe(time.Since(startTime).Seconds())
	middleware.ScanStocksProcessed.WithLabelValues("success").Add(float64(successCount))
	middleware.ScanStocksProcessed.WithLabelValues("failed").Add(float64(failedCount))

	log.Info().
		Int("processed", processedCount).
		Int("success", successCount).
		Int("failed", failedCount).
		Int("results", len(results)).
		Int("execution_ms", executionTime).
		Msg("Scan completed")
}

// fetchHistoricalStockData fetches historical OHLCV data with Redis caching.
// Uses Yahoo Finance API (same as Python's yfinance).
func (e *ScanExecutor) fetchHistoricalStockData(
	ctx context.Context,
	symbol string,
	exchange string,
	fromDate time.Time,
	currentQuote *marketdata.StockQuote,
	log *logger.Logger,
) *strategies.StockData {
	now := time.Now()
	cacheKey := cache.MarketDataKey(symbol)

	if e.cache != nil {
		var cached []marketdata.HistoricalData
		if err := e.cache.Get(ctx, cacheKey, &cached); err == nil && len(cached) > 0 {
			middleware.CacheHits.WithLabelValues("hit").Inc()
			log.Debug().Str("symbol", symbol).Int("points", len(cached)).Msg("Market data from cache")
			return e.buildStockData(symbol, exchange, cached, currentQuote)
		}
		middleware.CacheHits.WithLabelValues("miss").Inc()
	}

	historicalData, err := e.marketData.GetHistoricalData(ctx, symbol, fromDate, now)
	if err != nil {
		log.Warn().Err(err).Str("symbol", symbol).Msg("Failed to fetch historical data")
		return nil
	}

	if len(historicalData) == 0 {
		log.Warn().Str("symbol", symbol).Msg("No historical data returned")
		return nil
	}

	// Cache for 4 hours (market data refreshes daily)
	if e.cache != nil {
		if err := e.cache.Set(ctx, cacheKey, historicalData, 4*time.Hour); err != nil {
			log.Warn().Err(err).Str("symbol", symbol).Msg("Failed to cache market data")
		}
	}

	log.Debug().Str("symbol", symbol).Int("points", len(historicalData)).Msg("Market data fetched from Yahoo Finance")
	return e.buildStockData(symbol, exchange, historicalData, currentQuote)
}

func (e *ScanExecutor) buildStockData(
	symbol, exchange string,
	historicalData []marketdata.HistoricalData,
	currentQuote *marketdata.StockQuote,
) *strategies.StockData {
	stockData := &strategies.StockData{
		Symbol:   symbol,
		Exchange: exchange,
		Dates:    make([]time.Time, len(historicalData)),
		Open:     make([]float64, len(historicalData)),
		High:     make([]float64, len(historicalData)),
		Low:      make([]float64, len(historicalData)),
		Close:    make([]float64, len(historicalData)),
		Volume:   make([]float64, len(historicalData)),
		AdjClose: make([]float64, len(historicalData)),
	}

	lastDateStr := ""
	for i, d := range historicalData {
		stockData.Dates[i] = d.Date
		stockData.Open[i] = d.Open
		stockData.High[i] = d.High
		stockData.Low[i] = d.Low
		stockData.Close[i] = d.Close
		stockData.Volume[i] = float64(d.Volume)
		stockData.AdjClose[i] = d.Close
		lastDateStr = d.Date.Format("2006-01-02")
	}

	todayStr := time.Now().Format("2006-01-02")
	if lastDateStr != todayStr && currentQuote != nil && currentQuote.LTP > 0 {
		stockData.Dates = append(stockData.Dates, time.Now())
		stockData.Open = append(stockData.Open, currentQuote.Open)
		stockData.High = append(stockData.High, currentQuote.High)
		stockData.Low = append(stockData.Low, currentQuote.Low)
		stockData.Close = append(stockData.Close, currentQuote.LTP)
		stockData.Volume = append(stockData.Volume, float64(currentQuote.Volume))
		stockData.AdjClose = append(stockData.AdjClose, currentQuote.LTP)
	}

	return stockData
}

func (e *ScanExecutor) broadcastProgress(scanID uuid.UUID, status string, total, processed, success, failed, results int, execMs int) {
	if e.wsHub == nil {
		return
	}
	e.wsHub.BroadcastScanProgress(&websocket.ScanProgress{
		ScanID:           scanID.String(),
		Status:           status,
		TotalStocks:      total,
		ProcessedStocks:  processed,
		SuccessfulStocks: success,
		FailedStocks:     failed,
		ResultsCount:     results,
		ExecutionTimeMs:  execMs,
	})
}

func (e *ScanExecutor) failScan(ctx context.Context, scanID uuid.UUID, message string) {
	middleware.ScanExecutionDuration.WithLabelValues("failed").Observe(0)
	_ = e.scanRepo.UpdateStatus(ctx, scanID, models.ScanStatusFailed, map[string]interface{}{
		"error_message": message,
	})
}

// Errors
var (
	ErrQueueFull = &ScanError{Message: "scan queue is full"}
)

type ScanError struct {
	Message string
}

func (e *ScanError) Error() string {
	return e.Message
}
