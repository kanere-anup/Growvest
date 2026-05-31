package repository

import (
	"context"
	"time"

	"github.com/growvest/stock-screener/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// StockPriceRepository handles stock price database operations
type StockPriceRepository struct {
	db *gorm.DB
}

// NewStockPriceRepository creates a new stock price repository
func NewStockPriceRepository(db *gorm.DB) *StockPriceRepository {
	return &StockPriceRepository{db: db}
}

// GetBySymbolDateRange returns stock prices for a symbol within a date range, ordered by date ascending
func (r *StockPriceRepository) GetBySymbolDateRange(ctx context.Context, symbol string, from, to time.Time) ([]models.StockPrice, error) {
	var prices []models.StockPrice
	result := r.db.WithContext(ctx).
		Where("symbol = ? AND date >= ? AND date <= ?", symbol, from, to).
		Order("date ASC").
		Find(&prices)
	return prices, result.Error
}

// GetLatestDate returns the most recent date we have data for a given symbol
func (r *StockPriceRepository) GetLatestDate(ctx context.Context, symbol string) (*time.Time, error) {
	var price models.StockPrice
	result := r.db.WithContext(ctx).
		Where("symbol = ?", symbol).
		Order("date DESC").
		First(&price)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, result.Error
	}
	return &price.Date, nil
}

// GetEarliestDate returns the earliest date we have data for a given symbol
func (r *StockPriceRepository) GetEarliestDate(ctx context.Context, symbol string) (*time.Time, error) {
	var price models.StockPrice
	result := r.db.WithContext(ctx).
		Where("symbol = ?", symbol).
		Order("date ASC").
		First(&price)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, result.Error
	}
	return &price.Date, nil
}

// BulkUpsert inserts or updates stock prices in bulk (skips conflicts on stock_id+date unique index)
func (r *StockPriceRepository) BulkUpsert(ctx context.Context, prices []models.StockPrice) error {
	if len(prices) == 0 {
		return nil
	}

	// Process in batches of 500 to avoid query size limits
	batchSize := 500
	for i := 0; i < len(prices); i += batchSize {
		end := i + batchSize
		if end > len(prices) {
			end = len(prices)
		}
		batch := prices[i:end]

		result := r.db.WithContext(ctx).
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "stock_id"}, {Name: "date"}},
				DoUpdates: clause.AssignmentColumns([]string{"open", "high", "low", "close", "volume", "adj_close"}),
			}).
			Create(&batch)
		if result.Error != nil {
			return result.Error
		}
	}
	return nil
}

// CountBySymbol returns the number of price records for a symbol
func (r *StockPriceRepository) CountBySymbol(ctx context.Context, symbol string) (int64, error) {
	var count int64
	result := r.db.WithContext(ctx).
		Model(&models.StockPrice{}).
		Where("symbol = ?", symbol).
		Count(&count)
	return count, result.Error
}
