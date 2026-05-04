package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/models"
	"gorm.io/gorm"
)

var (
	ErrStockNotFound      = errors.New("stock not found")
	ErrStockAlreadyExists = errors.New("stock with this symbol already exists")
)

// StockRepository handles stock database operations
type StockRepository struct {
	db *gorm.DB
}

// NewStockRepository creates a new stock repository
func NewStockRepository(db *gorm.DB) *StockRepository {
	return &StockRepository{db: db}
}

// Create inserts a new stock into the database
func (r *StockRepository) Create(ctx context.Context, stock *models.Stock) error {
	result := r.db.WithContext(ctx).Create(stock)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrDuplicatedKey) {
			return ErrStockAlreadyExists
		}
		return result.Error
	}
	return nil
}

// GetByID retrieves a stock by its ID
func (r *StockRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Stock, error) {
	var stock models.Stock
	result := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&stock)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrStockNotFound
		}
		return nil, result.Error
	}
	return &stock, nil
}

// GetBySymbol retrieves a stock by its symbol
func (r *StockRepository) GetBySymbol(ctx context.Context, symbol string) (*models.Stock, error) {
	var stock models.Stock
	result := r.db.WithContext(ctx).Where("symbol = ? AND deleted_at IS NULL", symbol).First(&stock)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrStockNotFound
		}
		return nil, result.Error
	}
	return &stock, nil
}

// Update updates a stock's information
func (r *StockRepository) Update(ctx context.Context, stock *models.Stock) error {
	return r.db.WithContext(ctx).Save(stock).Error
}

// Delete soft-deletes a stock
func (r *StockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Stock{}, id).Error
}

// ListOptions contains options for listing stocks
type ListOptions struct {
	Limit     int
	Offset    int
	Active    *bool
	Exchange  string
	Sector    string
	Search    string
	OrderBy   string
	OrderDesc bool
}

// List retrieves a paginated list of stocks
func (r *StockRepository) List(ctx context.Context, opts ListOptions) ([]models.Stock, int64, error) {
	var stocks []models.Stock
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Stock{}).Where("deleted_at IS NULL")

	// Apply filters
	if opts.Active != nil {
		query = query.Where("is_active = ?", *opts.Active)
	}
	if opts.Exchange != "" {
		query = query.Where("exchange = ?", opts.Exchange)
	}
	if opts.Sector != "" {
		query = query.Where("sector = ?", opts.Sector)
	}
	if opts.Search != "" {
		search := "%" + opts.Search + "%"
		query = query.Where("symbol ILIKE ? OR name ILIKE ?", search, search)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply ordering
	orderBy := "symbol"
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

	// Execute query
	if err := query.Find(&stocks).Error; err != nil {
		return nil, 0, err
	}

	return stocks, total, nil
}

// GetActiveSymbols returns all active stock symbols
func (r *StockRepository) GetActiveSymbols(ctx context.Context) ([]string, error) {
	var symbols []string
	err := r.db.WithContext(ctx).Model(&models.Stock{}).
		Where("is_active = ? AND deleted_at IS NULL", true).
		Pluck("symbol", &symbols).Error
	return symbols, err
}

// GetActiveStocks returns all active stocks
func (r *StockRepository) GetActiveStocks(ctx context.Context) ([]models.Stock, error) {
	var stocks []models.Stock
	err := r.db.WithContext(ctx).
		Where("is_active = ? AND deleted_at IS NULL", true).
		Find(&stocks).Error
	return stocks, err
}

// --- User Stock (Watchlist) Methods ---

// AddToWatchlist adds a stock to user's watchlist
func (r *StockRepository) AddToWatchlist(ctx context.Context, userStock *models.UserStock) error {
	return r.db.WithContext(ctx).Create(userStock).Error
}

// RemoveFromWatchlist removes a stock from user's watchlist
func (r *StockRepository) RemoveFromWatchlist(ctx context.Context, userID, stockID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND stock_id = ?", userID, stockID).
		Delete(&models.UserStock{}).Error
}

// GetWatchlist retrieves user's stock watchlist
func (r *StockRepository) GetWatchlist(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.UserStock, int64, error) {
	var userStocks []models.UserStock
	var total int64

	query := r.db.WithContext(ctx).Model(&models.UserStock{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Stock").
		Order("is_favorite DESC, created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&userStocks).Error

	return userStocks, total, err
}

// IsInWatchlist checks if a stock is in user's watchlist
func (r *StockRepository) IsInWatchlist(ctx context.Context, userID, stockID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.UserStock{}).
		Where("user_id = ? AND stock_id = ?", userID, stockID).
		Count(&count).Error
	return count > 0, err
}

// UpdateWatchlistItem updates a watchlist entry
func (r *StockRepository) UpdateWatchlistItem(ctx context.Context, userID, stockID uuid.UUID, updates map[string]interface{}) error {
	return r.db.WithContext(ctx).Model(&models.UserStock{}).
		Where("user_id = ? AND stock_id = ?", userID, stockID).
		Updates(updates).Error
}

