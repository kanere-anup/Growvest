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
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user with this email already exists")
	ErrSessionNotFound   = errors.New("session not found")
)

// UserRepository handles user database operations
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create inserts a new user into the database
func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	result := r.db.WithContext(ctx).Create(user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrDuplicatedKey) {
			return ErrUserAlreadyExists
		}
		return result.Error
	}
	return nil
}

// GetByID retrieves a user by their ID
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	result := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

// GetByEmail retrieves a user by their email
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	result := r.db.WithContext(ctx).Where("email = ? AND deleted_at IS NULL", email).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

// Update updates a user's information
func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// Delete soft-deletes a user
func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.User{}, id).Error
}

// ExistsByEmail checks if a user with the given email exists
func (r *UserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var count int64
	result := r.db.WithContext(ctx).Model(&models.User{}).Where("email = ? AND deleted_at IS NULL", email).Count(&count)
	if result.Error != nil {
		return false, result.Error
	}
	return count > 0, nil
}

// --- Refresh Session Methods ---

// CreateRefreshSession creates a new refresh session
func (r *UserRepository) CreateRefreshSession(ctx context.Context, session *models.RefreshSession) error {
	return r.db.WithContext(ctx).Create(session).Error
}

// GetRefreshSession retrieves a refresh session by token hash
func (r *UserRepository) GetRefreshSession(ctx context.Context, tokenHash string) (*models.RefreshSession, error) {
	var session models.RefreshSession
	result := r.db.WithContext(ctx).Where("token_hash = ?", tokenHash).First(&session)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, result.Error
	}
	return &session, nil
}

// RevokeRefreshSession marks a refresh session as revoked
func (r *UserRepository) RevokeRefreshSession(ctx context.Context, tokenHash string, replacedBy string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&models.RefreshSession{}).
		Where("token_hash = ? AND revoked_at IS NULL", tokenHash).
		Updates(map[string]interface{}{
			"revoked_at":  now,
			"replaced_by": replacedBy,
		}).Error
}

// RevokeAllUserSessions revokes all refresh sessions for a user
func (r *UserRepository) RevokeAllUserSessions(ctx context.Context, userID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&models.RefreshSession{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", now).Error
}

// CleanupExpiredSessions removes expired sessions
func (r *UserRepository) CleanupExpiredSessions(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ?", time.Now()).
		Delete(&models.RefreshSession{}).Error
}

