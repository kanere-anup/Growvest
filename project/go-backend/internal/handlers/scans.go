package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/middleware"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
	"github.com/growvest/stock-screener/pkg/logger"
)

// ScanEnqueuer interface for enqueueing scans
type ScanEnqueuer interface {
	EnqueueScan(scanID uuid.UUID) error
}

// ScanHandler handles scan-related endpoints
type ScanHandler struct {
	scanRepo     *repository.ScanRepository
	stockRepo    *repository.StockRepository
	strategyRepo *repository.StrategyRepository
	executor     ScanEnqueuer
	logger       *logger.Logger
}

// NewScanHandler creates a new scan handler
func NewScanHandler(
	scanRepo *repository.ScanRepository,
	stockRepo *repository.StockRepository,
	strategyRepo *repository.StrategyRepository,
	executor ScanEnqueuer,
	log *logger.Logger,
) *ScanHandler {
	return &ScanHandler{
		scanRepo:     scanRepo,
		stockRepo:    stockRepo,
		strategyRepo: strategyRepo,
		executor:     executor,
		logger:       log.WithComponent("scan_handler"),
	}
}

// StartScanRequest is the request for starting a scan
type StartScanRequest struct {
	Name        string      `json:"name"`
	StrategyIDs []uuid.UUID `json:"strategy_ids"`
	StockIDs    []uuid.UUID `json:"stock_ids"`
}

// ScanResponse is the response for scan data
type ScanResponse struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	Status           string    `json:"status"`
	TotalStocks      int       `json:"total_stocks"`
	ProcessedStocks  int       `json:"processed_stocks"`
	SuccessfulStocks int       `json:"successful_stocks"`
	FailedStocks     int       `json:"failed_stocks"`
	ResultsCount     int       `json:"results_count"`
	ExecutionTimeMs  int       `json:"execution_time_ms"`
	ErrorMessage     string    `json:"error_message,omitempty"`
	StartedAt        *string   `json:"started_at,omitempty"`
	CompletedAt      *string   `json:"completed_at,omitempty"`
	CreatedAt        string    `json:"created_at"`
}

// ScanResultResponse is the response for scan result data
type ScanResultResponse struct {
	ID           uuid.UUID              `json:"id"`
	Symbol       string                 `json:"symbol"`
	CurrentPrice float64                `json:"current_price"`
	Score        float64                `json:"score"`
	Signal       string                 `json:"signal"`
	ResultData   map[string]interface{} `json:"result_data"`
	Strategy     StrategyResponse       `json:"strategy"`
	CreatedAt    string                 `json:"created_at"`
}

// StartScan initiates a new scan
func (h *ScanHandler) StartScan(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req StartScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	// Get stocks to scan
	var stocks []models.Stock
	var err error
	if len(req.StockIDs) > 0 {
		// Get specified stocks
		for _, stockID := range req.StockIDs {
			stock, err := h.stockRepo.GetByID(c.Request.Context(), stockID)
			if err == nil && stock.IsActive {
				stocks = append(stocks, *stock)
			}
		}
	} else {
		// Get all active stocks
		stocks, err = h.stockRepo.GetActiveStocks(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to get stocks"})
			return
		}
	}

	if len(stocks) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "No stocks to scan"})
		return
	}

	// Get strategies to use
	var userStrategies []models.UserStrategy
	if len(req.StrategyIDs) > 0 {
		// Get specified strategies
		for _, strategyID := range req.StrategyIDs {
			userStrategy, err := h.strategyRepo.GetUserStrategy(c.Request.Context(), userID, strategyID)
			if err == nil && userStrategy.IsEnabled {
				userStrategies = append(userStrategies, *userStrategy)
			}
		}
	} else {
		// Get all enabled user strategies
		userStrategies, err = h.strategyRepo.ListEnabledUserStrategies(c.Request.Context(), userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to get strategies"})
			return
		}
	}

	if len(userStrategies) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "No strategies configured. Please configure strategies first."})
		return
	}

	// Create scan record
	now := time.Now()
	scan := &models.Scan{
		UserID:      userID,
		Name:        req.Name,
		Status:      models.ScanStatusPending,
		TotalStocks: len(stocks),
		StartedAt:   &now,
	}

	if err := h.scanRepo.Create(c.Request.Context(), scan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to create scan"})
		return
	}

	// Add stocks to scan
	stockIDs := make([]uuid.UUID, len(stocks))
	for i, s := range stocks {
		stockIDs[i] = s.ID
	}
	_ = h.scanRepo.AddScanStocks(c.Request.Context(), scan.ID, stockIDs)

	// Add strategies to scan
	scanStrategies := make([]models.ScanStrategy, len(userStrategies))
	for i, us := range userStrategies {
		scanStrategies[i] = models.ScanStrategy{
			ScanID:             scan.ID,
			UserStrategyID:     us.ID,
			ParametersSnapshot: us.Parameters,
		}
	}
	_ = h.scanRepo.AddScanStrategies(c.Request.Context(), scanStrategies)

	// Enqueue scan for background processing
	if h.executor != nil {
		if err := h.executor.EnqueueScan(scan.ID); err != nil {
			h.logger.Warn().Err(err).Str("scan_id", scan.ID.String()).Msg("Failed to enqueue scan")
			// Scan is created but will be picked up by background checker
		} else {
			h.logger.Info().Str("scan_id", scan.ID.String()).Msg("Scan enqueued for processing")
		}
	} else {
		h.logger.Warn().Msg("Scan executor not configured - scan will not be processed")
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Scan started",
		"scan":    toScanResponse(*scan),
	})
}

// ListScans returns user's scans
func (h *ScanHandler) ListScans(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var params struct {
		Limit  int    `form:"limit,default=20"`
		Offset int    `form:"offset,default=0"`
		Status string `form:"status"`
	}
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_params"})
		return
	}

	if params.Limit > 100 {
		params.Limit = 100
	}

	opts := repository.ScanListOptions{
		Limit:  params.Limit,
		Offset: params.Offset,
		Status: params.Status,
	}

	scans, total, err := h.scanRepo.ListByUser(c.Request.Context(), userID, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	// Get results count for all scans in batch
	scanIDs := make([]uuid.UUID, len(scans))
	for i, s := range scans {
		scanIDs[i] = s.ID
	}
	resultsCounts, _ := h.scanRepo.GetResultsCountBatch(c.Request.Context(), scanIDs)

	items := make([]ScanResponse, len(scans))
	for i, s := range scans {
		items[i] = toScanResponse(s)
		if count, ok := resultsCounts[s.ID]; ok {
			items[i].ResultsCount = int(count)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  params.Limit,
		"offset": params.Offset,
	})
}

// GetScan returns a single scan by ID
func (h *ScanHandler) GetScan(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	scan, err := h.scanRepo.GetByIDWithDetails(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrScanNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	// Verify ownership
	if scan.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	resp := toScanResponse(*scan)
	if count, err := h.scanRepo.GetResultsCount(c.Request.Context(), id); err == nil {
		resp.ResultsCount = int(count)
	}

	c.JSON(http.StatusOK, resp)
}

// GetScanStatus returns the status of a scan
func (h *ScanHandler) GetScanStatus(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	scan, err := h.scanRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrScanNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	if scan.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":               scan.ID,
		"status":           scan.Status,
		"total_stocks":     scan.TotalStocks,
		"processed_stocks": scan.ProcessedStocks,
		"successful_stocks": scan.SuccessfulStocks,
		"failed_stocks":    scan.FailedStocks,
		"execution_time_ms": scan.ExecutionTimeMs,
	})
}

// GetScanResults returns the results of a scan
func (h *ScanHandler) GetScanResults(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	// Verify ownership
	scan, err := h.scanRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrScanNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	if scan.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var params struct {
		Limit      int     `form:"limit,default=50"`
		Offset     int     `form:"offset,default=0"`
		StrategyID *string `form:"strategy_id"`
		Signal     string  `form:"signal"`
		MinScore   *float64 `form:"min_score"`
	}
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_params"})
		return
	}

	opts := repository.ResultListOptions{
		Limit:     params.Limit,
		Offset:    params.Offset,
		Signal:    params.Signal,
		MinScore:  params.MinScore,
		OrderBy:   "score",
		OrderDesc: true,
	}

	if params.StrategyID != nil {
		strategyID, err := uuid.Parse(*params.StrategyID)
		if err == nil {
			opts.StrategyID = &strategyID
		}
	}

	results, total, err := h.scanRepo.GetResults(c.Request.Context(), id, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	items := make([]ScanResultResponse, len(results))
	for i, r := range results {
		items[i] = toScanResultResponse(r)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  params.Limit,
		"offset": params.Offset,
	})
}

// ExportScanResults exports scan results as CSV
func (h *ScanHandler) ExportScanResults(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	// Verify ownership
	scan, err := h.scanRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrScanNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	if scan.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// Get all results (no pagination for export)
	opts := repository.ResultListOptions{
		Limit:     1000, // Max 1000 results for export
		Offset:    0,
		OrderBy:   "score",
		OrderDesc: true,
	}

	results, _, err := h.scanRepo.GetResults(c.Request.Context(), id, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	// Generate CSV content
	csvContent := "Symbol,Strategy,Price,Signal,Score,Date\n"
	for _, r := range results {
		csvContent += fmt.Sprintf("%s,%s,%.2f,%s,%.2f,%s\n",
			r.Symbol,
			r.Strategy.DisplayName,
			r.CurrentPrice,
			r.Signal,
			r.Score,
			r.CreatedAt.Format("2006-01-02 15:04:05"),
		)
	}

	// Set headers for file download
	scanName := scan.Name
	if scanName == "" {
		scanName = scan.ID.String()[:8]
	}
	filename := fmt.Sprintf("scan_results_%s_%s.csv", scanName, time.Now().Format("20060102"))

	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "text/csv")
	c.String(http.StatusOK, csvContent)
}

// DeleteScan deletes a scan and its results
func (h *ScanHandler) DeleteScan(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	// Verify ownership
	scan, err := h.scanRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrScanNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	if scan.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// Don't delete running scans
	if scan.Status == models.ScanStatusRunning {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "Cannot delete a running scan"})
		return
	}

	if err := h.scanRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Scan deleted"})
}

// --- Analytics Endpoints ---

// GetAnalytics returns strategy performance analytics
func (h *ScanHandler) GetAnalytics(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var params struct {
		Days int `form:"days,default=30"`
	}
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_params"})
		return
	}

	if params.Days > 365 {
		params.Days = 365
	}

	stats, err := h.scanRepo.GetStrategyPerformance(c.Request.Context(), userID, params.Days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"period_days": params.Days,
		"strategies":  stats,
	})
}

// GetTopStocks returns top stocks by frequency
func (h *ScanHandler) GetTopStocks(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var params struct {
		Days       int     `form:"days,default=30"`
		Limit      int     `form:"limit,default=10"`
		StrategyID *string `form:"strategy_id"`
	}
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_params"})
		return
	}

	var strategyID *uuid.UUID
	if params.StrategyID != nil {
		id, err := uuid.Parse(*params.StrategyID)
		if err == nil {
			strategyID = &id
		}
	}

	stocks, err := h.scanRepo.GetTopStocks(c.Request.Context(), userID, params.Days, params.Limit, strategyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, stocks)
}

// Helper functions

func toScanResponse(s models.Scan) ScanResponse {
	resp := ScanResponse{
		ID:               s.ID,
		Name:             s.Name,
		Status:           s.Status,
		TotalStocks:      s.TotalStocks,
		ProcessedStocks:  s.ProcessedStocks,
		SuccessfulStocks: s.SuccessfulStocks,
		FailedStocks:     s.FailedStocks,
		ExecutionTimeMs:  s.ExecutionTimeMs,
		ErrorMessage:     s.ErrorMessage,
		CreatedAt:        s.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}

	if s.StartedAt != nil {
		startedAt := s.StartedAt.Format("2006-01-02T15:04:05Z")
		resp.StartedAt = &startedAt
	}
	if s.CompletedAt != nil {
		completedAt := s.CompletedAt.Format("2006-01-02T15:04:05Z")
		resp.CompletedAt = &completedAt
	}

	return resp
}

func toScanResultResponse(r models.ScanResult) ScanResultResponse {
	return ScanResultResponse{
		ID:           r.ID,
		Symbol:       r.Symbol,
		CurrentPrice: r.CurrentPrice,
		Score:        r.Score,
		Signal:       r.Signal,
		ResultData:   r.ResultData,
		Strategy:     toStrategyResponse(r.Strategy),
		CreatedAt:    r.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

