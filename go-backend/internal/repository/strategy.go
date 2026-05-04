package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/models"
	"gorm.io/gorm"
)

var (
	ErrStrategyNotFound      = errors.New("strategy not found")
	ErrStrategyAlreadyExists = errors.New("strategy with this name already exists")
	ErrUserStrategyNotFound  = errors.New("user strategy configuration not found")
)

// StrategyRepository handles strategy database operations
type StrategyRepository struct {
	db *gorm.DB
}

// NewStrategyRepository creates a new strategy repository
func NewStrategyRepository(db *gorm.DB) *StrategyRepository {
	return &StrategyRepository{db: db}
}

// --- Base Strategy Methods ---

// Create inserts a new strategy into the database
func (r *StrategyRepository) Create(ctx context.Context, strategy *models.Strategy) error {
	result := r.db.WithContext(ctx).Create(strategy)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrDuplicatedKey) {
			return ErrStrategyAlreadyExists
		}
		return result.Error
	}
	return nil
}

// GetByID retrieves a strategy by its ID
func (r *StrategyRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Strategy, error) {
	var strategy models.Strategy
	result := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&strategy)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrStrategyNotFound
		}
		return nil, result.Error
	}
	return &strategy, nil
}

// GetByName retrieves a strategy by its name
func (r *StrategyRepository) GetByName(ctx context.Context, name string) (*models.Strategy, error) {
	var strategy models.Strategy
	result := r.db.WithContext(ctx).Where("name = ? AND deleted_at IS NULL", name).First(&strategy)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrStrategyNotFound
		}
		return nil, result.Error
	}
	return &strategy, nil
}

// Update updates a strategy's information
func (r *StrategyRepository) Update(ctx context.Context, strategy *models.Strategy) error {
	return r.db.WithContext(ctx).Save(strategy).Error
}

// Delete soft-deletes a strategy
func (r *StrategyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Strategy{}, id).Error
}

// List retrieves all active strategies
func (r *StrategyRepository) List(ctx context.Context, includeInactive bool) ([]models.Strategy, error) {
	var strategies []models.Strategy
	query := r.db.WithContext(ctx).Where("deleted_at IS NULL")
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}
	err := query.Order("is_system DESC, display_name ASC").Find(&strategies).Error
	return strategies, err
}

// ListSystemStrategies retrieves only system-defined strategies
func (r *StrategyRepository) ListSystemStrategies(ctx context.Context) ([]models.Strategy, error) {
	var strategies []models.Strategy
	err := r.db.WithContext(ctx).
		Where("is_system = ? AND is_active = ? AND deleted_at IS NULL", true, true).
		Order("display_name ASC").
		Find(&strategies).Error
	return strategies, err
}

// --- User Strategy Methods ---

// CreateUserStrategy creates a user's strategy configuration
func (r *StrategyRepository) CreateUserStrategy(ctx context.Context, userStrategy *models.UserStrategy) error {
	return r.db.WithContext(ctx).Create(userStrategy).Error
}

// GetUserStrategyByID retrieves a user strategy by ID
func (r *StrategyRepository) GetUserStrategyByID(ctx context.Context, id uuid.UUID) (*models.UserStrategy, error) {
	var userStrategy models.UserStrategy
	result := r.db.WithContext(ctx).
		Preload("Strategy").
		Where("id = ? AND deleted_at IS NULL", id).
		First(&userStrategy)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserStrategyNotFound
		}
		return nil, result.Error
	}
	return &userStrategy, nil
}

// GetUserStrategy retrieves a specific user strategy configuration
func (r *StrategyRepository) GetUserStrategy(ctx context.Context, userID, strategyID uuid.UUID) (*models.UserStrategy, error) {
	var userStrategy models.UserStrategy
	result := r.db.WithContext(ctx).
		Preload("Strategy").
		Where("user_id = ? AND strategy_id = ? AND deleted_at IS NULL", userID, strategyID).
		First(&userStrategy)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserStrategyNotFound
		}
		return nil, result.Error
	}
	return &userStrategy, nil
}

// UpdateUserStrategy updates a user's strategy configuration
func (r *StrategyRepository) UpdateUserStrategy(ctx context.Context, userStrategy *models.UserStrategy) error {
	return r.db.WithContext(ctx).Save(userStrategy).Error
}

// DeleteUserStrategy removes a user's strategy configuration
func (r *StrategyRepository) DeleteUserStrategy(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.UserStrategy{}, id).Error
}

// ListUserStrategies retrieves all strategy configurations for a user
func (r *StrategyRepository) ListUserStrategies(ctx context.Context, userID uuid.UUID) ([]models.UserStrategy, error) {
	var userStrategies []models.UserStrategy
	err := r.db.WithContext(ctx).
		Preload("Strategy").
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Order("priority ASC, created_at ASC").
		Find(&userStrategies).Error
	return userStrategies, err
}

// ListEnabledUserStrategies retrieves enabled strategy configurations for a user
func (r *StrategyRepository) ListEnabledUserStrategies(ctx context.Context, userID uuid.UUID) ([]models.UserStrategy, error) {
	var userStrategies []models.UserStrategy
	err := r.db.WithContext(ctx).
		Preload("Strategy").
		Where("user_id = ? AND is_enabled = ? AND deleted_at IS NULL", userID, true).
		Order("priority ASC").
		Find(&userStrategies).Error
	return userStrategies, err
}

// UserHasStrategy checks if user has configured a specific strategy
func (r *StrategyRepository) UserHasStrategy(ctx context.Context, userID, strategyID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.UserStrategy{}).
		Where("user_id = ? AND strategy_id = ? AND deleted_at IS NULL", userID, strategyID).
		Count(&count).Error
	return count > 0, err
}

