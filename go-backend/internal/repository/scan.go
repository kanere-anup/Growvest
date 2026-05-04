package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/models"
	"gorm.io/gorm"
)

var (
	ErrScanNotFound = errors.New("scan not found")
)

// ScanRepository handles scan database operations
type ScanRepository struct {
	db *gorm.DB
}

// NewScanRepository creates a new scan repository
func NewScanRepository(db *gorm.DB) *ScanRepository {
	return &ScanRepository{db: db}
}

// Create inserts a new scan into the database
func (r *ScanRepository) Create(ctx context.Context, scan *models.Scan) error {
	return r.db.WithContext(ctx).Create(scan).Error
}

// GetByID retrieves a scan by its ID
func (r *ScanRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Scan, error) {
	var scan models.Scan
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&scan)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrScanNotFound
		}
		return nil, result.Error
	}
	return &scan, nil
}

// GetByIDWithDetails retrieves a scan with all related data
func (r *ScanRepository) GetByIDWithDetails(ctx context.Context, id uuid.UUID) (*models.Scan, error) {
	var scan models.Scan
	result := r.db.WithContext(ctx).
		Preload("ScanStrategies.UserStrategy.Strategy").
		Where("id = ?", id).
		First(&scan)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrScanNotFound
		}
		return nil, result.Error
	}
	return &scan, nil
}

// Update updates a scan's information
func (r *ScanRepository) Update(ctx context.Context, scan *models.Scan) error {
	return r.db.WithContext(ctx).Save(scan).Error
}

// UpdateStatus updates scan status and related fields
func (r *ScanRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, updates map[string]interface{}) error {
	if updates == nil {
		updates = make(map[string]interface{})
	}
	updates["status"] = status
	updates["updated_at"] = time.Now()
	return r.db.WithContext(ctx).Model(&models.Scan{}).Where("id = ?", id).Updates(updates).Error
}

// Delete deletes a scan and all related data
func (r *ScanRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete scan results
		if err := tx.Where("scan_id = ?", id).Delete(&models.ScanResult{}).Error; err != nil {
			return err
		}
		// Delete scan strategies
		if err := tx.Where("scan_id = ?", id).Delete(&models.ScanStrategy{}).Error; err != nil {
			return err
		}
		// Delete scan stocks
		if err := tx.Where("scan_id = ?", id).Delete(&models.ScanStock{}).Error; err != nil {
			return err
		}
		// Delete scan
		return tx.Delete(&models.Scan{}, id).Error
	})
}

// ScanListOptions contains options for listing scans
type ScanListOptions struct {
	Limit  int
	Offset int
	Status string
}

// ListByUser retrieves paginated scans for a user
func (r *ScanRepository) ListByUser(ctx context.Context, userID uuid.UUID, opts ScanListOptions) ([]models.Scan, int64, error) {
	var scans []models.Scan
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Scan{}).Where("user_id = ?", userID)

	if opts.Status != "" {
		query = query.Where("status = ?", opts.Status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if opts.Limit > 0 {
		query = query.Limit(opts.Limit)
	}
	if opts.Offset > 0 {
		query = query.Offset(opts.Offset)
	}

	err := query.Order("created_at DESC").Find(&scans).Error
	return scans, total, err
}

// --- Scan Stocks Methods ---

// AddScanStocks adds stocks to a scan
func (r *ScanRepository) AddScanStocks(ctx context.Context, scanID uuid.UUID, stockIDs []uuid.UUID) error {
	scanStocks := make([]models.ScanStock, len(stockIDs))
	for i, stockID := range stockIDs {
		scanStocks[i] = models.ScanStock{
			ScanID:  scanID,
			StockID: stockID,
		}
	}
	return r.db.WithContext(ctx).Create(&scanStocks).Error
}

// GetScanStocks retrieves stocks for a scan
func (r *ScanRepository) GetScanStocks(ctx context.Context, scanID uuid.UUID) ([]models.Stock, error) {
	var stocks []models.Stock
	err := r.db.WithContext(ctx).
		Joins("JOIN scan_stocks ON scan_stocks.stock_id = stocks.id").
		Where("scan_stocks.scan_id = ?", scanID).
		Find(&stocks).Error
	return stocks, err
}

// --- Scan Strategies Methods ---

// AddScanStrategies adds strategies to a scan
func (r *ScanRepository) AddScanStrategies(ctx context.Context, scanStrategies []models.ScanStrategy) error {
	return r.db.WithContext(ctx).Create(&scanStrategies).Error
}

// --- Scan Results Methods ---

// CreateResults bulk inserts scan results
func (r *ScanRepository) CreateResults(ctx context.Context, results []models.ScanResult) error {
	if len(results) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Create(&results).Error
}

// ResultListOptions contains options for listing results
type ResultListOptions struct {
	Limit      int
	Offset     int
	StrategyID *uuid.UUID
	Signal     string
	MinScore   *float64
	MaxScore   *float64
	OrderBy    string
	OrderDesc  bool
}

// GetResults retrieves paginated results for a scan
func (r *ScanRepository) GetResults(ctx context.Context, scanID uuid.UUID, opts ResultListOptions) ([]models.ScanResult, int64, error) {
	var results []models.ScanResult
	var total int64

	query := r.db.WithContext(ctx).Model(&models.ScanResult{}).Where("scan_id = ?", scanID)

	// Apply filters
	if opts.StrategyID != nil {
		query = query.Where("strategy_id = ?", *opts.StrategyID)
	}
	if opts.Signal != "" {
		query = query.Where("signal = ?", opts.Signal)
	}
	if opts.MinScore != nil {
		query = query.Where("score >= ?", *opts.MinScore)
	}
	if opts.MaxScore != nil {
		query = query.Where("score <= ?", *opts.MaxScore)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply ordering
	orderBy := "score"
	if opts.OrderBy != "" {
		orderBy = opts.OrderBy
	}
	if opts.OrderDesc {
		orderBy += " DESC"
	}
	query = query.Order(orderBy)

	// Apply pagination
	if opts.Limit > 0 {
		query = query.Limit(opts.Limit)
	}
	if opts.Offset > 0 {
		query = query.Offset(opts.Offset)
	}

	// Execute query with preloads
	err := query.
		Preload("Stock").
		Preload("Strategy").
		Find(&results).Error

	return results, total, err
}

// GetResultsByStrategy groups results by strategy for a scan
func (r *ScanRepository) GetResultsByStrategy(ctx context.Context, scanID uuid.UUID) (map[string][]models.ScanResult, error) {
	var results []models.ScanResult
	err := r.db.WithContext(ctx).
		Preload("Strategy").
		Preload("Stock").
		Where("scan_id = ?", scanID).
		Order("strategy_id, score DESC").
		Find(&results).Error

	if err != nil {
		return nil, err
	}

	grouped := make(map[string][]models.ScanResult)
	for _, result := range results {
		strategyName := result.Strategy.Name
		grouped[strategyName] = append(grouped[strategyName], result)
	}

	return grouped, nil
}

// --- Analytics Methods ---

// GetStrategyPerformance returns strategy performance stats
func (r *ScanRepository) GetStrategyPerformance(ctx context.Context, userID uuid.UUID, days int) ([]StrategyStats, error) {
	var stats []StrategyStats

	since := time.Now().AddDate(0, 0, -days)

	err := r.db.WithContext(ctx).
		Table("scan_results sr").
		Select(`
			s.name as strategy_name,
			s.display_name as strategy_display_name,
			COUNT(sr.id) as total_results,
			COUNT(DISTINCT sr.symbol) as unique_stocks,
			AVG(sr.score) as avg_score
		`).
		Joins("JOIN strategies s ON sr.strategy_id = s.id").
		Joins("JOIN scans sc ON sr.scan_id = sc.id").
		Where("sc.user_id = ? AND sr.created_at >= ?", userID, since).
		Group("s.id, s.name, s.display_name").
		Order("total_results DESC").
		Scan(&stats).Error

	return stats, err
}

// StrategyStats contains strategy performance statistics
type StrategyStats struct {
	StrategyName        string  `json:"strategy_name"`
	StrategyDisplayName string  `json:"strategy_display_name"`
	TotalResults        int     `json:"total_results"`
	UniqueStocks        int     `json:"unique_stocks"`
	AvgScore            float64 `json:"avg_score"`
}

// GetTopStocks returns top stocks by frequency
func (r *ScanRepository) GetTopStocks(ctx context.Context, userID uuid.UUID, days, limit int, strategyID *uuid.UUID) ([]TopStock, error) {
	var stocks []TopStock

	since := time.Now().AddDate(0, 0, -days)

	query := r.db.WithContext(ctx).
		Table("scan_results sr").
		Select(`
			sr.symbol,
			COUNT(sr.id) as hits,
			AVG(sr.score) as avg_score,
			MAX(sr.created_at) as last_seen
		`).
		Joins("JOIN scans sc ON sr.scan_id = sc.id").
		Where("sc.user_id = ? AND sr.created_at >= ?", userID, since)

	if strategyID != nil {
		query = query.Where("sr.strategy_id = ?", *strategyID)
	}

	err := query.
		Group("sr.symbol").
		Order("hits DESC, last_seen DESC").
		Limit(limit).
		Scan(&stocks).Error

	return stocks, err
}

// TopStock contains top stock statistics
type TopStock struct {
	Symbol   string    `json:"symbol"`
	Hits     int       `json:"hits"`
	AvgScore float64   `json:"avg_score"`
	LastSeen time.Time `json:"last_seen"`
}

// --- Executor Methods ---

// GetPendingScans returns scans that need processing
func (r *ScanRepository) GetPendingScans(ctx context.Context, limit int) ([]models.Scan, error) {
	var scans []models.Scan

	// Find pending or running scans that are stalled
	stalledTime := time.Now().Add(-5 * time.Minute)

	err := r.db.WithContext(ctx).
		Where("status = ? OR (status = ? AND updated_at < ?)",
			models.ScanStatusPending,
			models.ScanStatusRunning,
			stalledTime).
		Limit(limit).
		Find(&scans).Error

	return scans, err
}

// GetScanStrategies returns strategies for a scan with full details
func (r *ScanRepository) GetScanStrategies(ctx context.Context, scanID uuid.UUID) ([]models.ScanStrategy, error) {
	var scanStrategies []models.ScanStrategy
	err := r.db.WithContext(ctx).
		Preload("UserStrategy.Strategy").
		Where("scan_id = ?", scanID).
		Find(&scanStrategies).Error
	return scanStrategies, err
}

// UpdateProgress updates scan progress counters
func (r *ScanRepository) UpdateProgress(ctx context.Context, scanID uuid.UUID, processed, successful, failed int) error {
	return r.db.WithContext(ctx).
		Model(&models.Scan{}).
		Where("id = ?", scanID).
		Updates(map[string]interface{}{
			"processed_stocks":  processed,
			"successful_stocks": successful,
			"failed_stocks":     failed,
			"updated_at":        time.Now(),
		}).Error
}

// SaveResults bulk saves scan results
func (r *ScanRepository) SaveResults(ctx context.Context, results []models.ScanResult) error {
	if len(results) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(&results, 100).Error
}

// CompleteScan marks a scan as completed
func (r *ScanRepository) CompleteScan(ctx context.Context, scanID uuid.UUID, successful, failed, executionTimeMs int) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&models.Scan{}).
		Where("id = ?", scanID).
		Updates(map[string]interface{}{
			"status":            models.ScanStatusCompleted,
			"successful_stocks": successful,
			"failed_stocks":     failed,
			"execution_time_ms": executionTimeMs,
			"completed_at":      &now,
			"updated_at":        now,
		}).Error
}

// GetResultsCount returns the number of results for a scan
func (r *ScanRepository) GetResultsCount(ctx context.Context, scanID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.ScanResult{}).
		Where("scan_id = ?", scanID).
		Count(&count).Error
	return count, err
}

// GetResultsCountBatch returns the results count for multiple scans
func (r *ScanRepository) GetResultsCountBatch(ctx context.Context, scanIDs []uuid.UUID) (map[uuid.UUID]int64, error) {
	if len(scanIDs) == 0 {
		return make(map[uuid.UUID]int64), nil
	}

	type CountResult struct {
		ScanID uuid.UUID `gorm:"column:scan_id"`
		Count  int64     `gorm:"column:count"`
	}

	var counts []CountResult
	err := r.db.WithContext(ctx).
		Model(&models.ScanResult{}).
		Select("scan_id, count(*) as count").
		Where("scan_id IN ?", scanIDs).
		Group("scan_id").
		Find(&counts).Error

	if err != nil {
		return nil, err
	}

	result := make(map[uuid.UUID]int64)
	for _, c := range counts {
		result[c.ScanID] = c.Count
	}
	return result, nil
}
