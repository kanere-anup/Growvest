package scanner

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
	"github.com/growvest/stock-screener/internal/services/marketdata"
	"github.com/growvest/stock-screener/internal/services/strategies"
	"github.com/growvest/stock-screener/pkg/logger"
)

// ScanExecutor processes scans in the background
type ScanExecutor struct {
	scanRepo     *repository.ScanRepository
	stockRepo    *repository.StockRepository
	strategyRepo *repository.StrategyRepository
	marketData   *marketdata.NSEService
	registry     *strategies.Registry
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

	// Fetch market data for all stocks
	symbols := make([]string, len(stocks))
	for i, s := range stocks {
		symbols[i] = s.Symbol
	}

	quotes, err := e.marketData.GetQuotes(ctx, symbols)
	if err != nil {
		log.Warn().Err(err).Msg("Some market data fetch failed")
	}

	// Process each stock with each strategy
	var results []models.ScanResult
	processedCount := 0
	successCount := 0
	failedCount := 0

	for _, stock := range stocks {
		quote, ok := quotes[stock.Symbol]
		if !ok {
			failedCount++
			processedCount++
			continue
		}

		// Run each strategy on this stock
		for _, scanStrategy := range scanStrategies {
			strategy, ok := e.registry.Get(scanStrategy.UserStrategy.Strategy.Name)
			if !ok {
				log.Warn().Str("strategy", scanStrategy.UserStrategy.Strategy.Name).Msg("Strategy not found in registry")
				continue
			}

			// Build stock data - check if strategy needs historical data
			var stockData *strategies.StockData

			if histNeeder, ok := strategy.(strategies.HistoricalDataNeeder); ok {
				needsData, fromDate := histNeeder.NeedsHistoricalData(scanStrategy.ParametersSnapshot)
				if needsData {
					// Fetch historical data from the anchor date to today
					stockData = e.fetchHistoricalStockData(ctx, stock.Symbol, stock.Exchange, fromDate, quote, log)
				}
			}

			// Fallback to current quote data if historical data not needed or fetch failed
			if stockData == nil {
				stockData = &strategies.StockData{
					Symbol:   stock.Symbol,
					Exchange: stock.Exchange,
					Dates:    []time.Time{time.Now()},
					Open:     []float64{quote.Open},
					High:     []float64{quote.High, quote.High52Week},
					Low:      []float64{quote.Low, quote.Low52Week},
					Close:    []float64{quote.PreviousClose, quote.LTP},
					Volume:   []float64{float64(quote.Volume)},
					AdjClose: []float64{quote.LTP},
				}
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

			// Only save results that matched
			if result.Matched && result.Signal != "" && result.Signal != "neutral" {
				results = append(results, models.ScanResult{
					ScanID:       scanID,
					StockID:      stock.ID,
					StrategyID:   scanStrategy.UserStrategy.StrategyID,
					Symbol:       stock.Symbol,
					CurrentPrice: quote.LTP,
					Score:        result.Score,
					Signal:       result.Signal,
					ResultData:   result.ResultData,
				})
			}
		}

		successCount++
		processedCount++

		// Update progress periodically
		if processedCount%10 == 0 {
			_ = e.scanRepo.UpdateProgress(ctx, scanID, processedCount, successCount, failedCount)
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

	log.Info().
		Int("processed", processedCount).
		Int("success", successCount).
		Int("failed", failedCount).
		Int("results", len(results)).
		Int("execution_ms", executionTime).
		Msg("Scan completed")
}

// fetchHistoricalStockData fetches historical OHLCV data from a given date to today
// using Yahoo Finance API (same as Python's yfinance) and builds a StockData struct.
// Yahoo Finance handles the full date range in a single call - no chunking needed.
func (e *ScanExecutor) fetchHistoricalStockData(
	ctx context.Context,
	symbol string,
	exchange string,
	fromDate time.Time,
	currentQuote *marketdata.StockQuote,
	log *logger.Logger,
) *strategies.StockData {
	now := time.Now()

	// Single call to Yahoo Finance for the full date range
	historicalData, err := e.marketData.GetHistoricalData(ctx, symbol, fromDate, now)
	if err != nil {
		log.Warn().Err(err).
			Str("symbol", symbol).
			Str("from", fromDate.Format("2006-01-02")).
			Str("to", now.Format("2006-01-02")).
			Msg("Failed to fetch historical data from Yahoo Finance")
		return nil
	}

	if len(historicalData) == 0 {
		log.Warn().Str("symbol", symbol).Msg("No historical data returned from Yahoo Finance")
		return nil
	}

	// Build StockData from historical data (already sorted by Yahoo Finance)
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

	// Append current live quote if today's data isn't in the historical data yet
	todayStr := now.Format("2006-01-02")
	if lastDateStr != todayStr && currentQuote != nil && currentQuote.LTP > 0 {
		stockData.Dates = append(stockData.Dates, now)
		stockData.Open = append(stockData.Open, currentQuote.Open)
		stockData.High = append(stockData.High, currentQuote.High)
		stockData.Low = append(stockData.Low, currentQuote.Low)
		stockData.Close = append(stockData.Close, currentQuote.LTP)
		stockData.Volume = append(stockData.Volume, float64(currentQuote.Volume))
		stockData.AdjClose = append(stockData.AdjClose, currentQuote.LTP)
	}

	log.Info().
		Str("symbol", symbol).
		Int("data_points", stockData.Len()).
		Str("from", fromDate.Format("2006-01-02")).
		Msg("Historical data fetched from Yahoo Finance")

	return stockData
}

// failScan marks a scan as failed
func (e *ScanExecutor) failScan(ctx context.Context, scanID uuid.UUID, message string) {
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
