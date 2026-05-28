package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/middleware"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
	"github.com/growvest/stock-screener/internal/services/strategies"
)

// StrategyHandler handles strategy-related endpoints
type StrategyHandler struct {
	strategyRepo *repository.StrategyRepository
	registry     *strategies.Registry
}

// NewStrategyHandler creates a new strategy handler
func NewStrategyHandler(strategyRepo *repository.StrategyRepository, registry *strategies.Registry) *StrategyHandler {
	return &StrategyHandler{
		strategyRepo: strategyRepo,
		registry:     registry,
	}
}

// StrategyResponse is the response for strategy data
type StrategyResponse struct {
	ID          uuid.UUID              `json:"id"`
	Name        string                 `json:"name"`
	DisplayName string                 `json:"display_name"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	Parameters  map[string]interface{} `json:"parameters"`
	IsSystem    bool                   `json:"is_system"`
	IsActive    bool                   `json:"is_active"`
}

// UserStrategyResponse is the response for user strategy configuration
type UserStrategyResponse struct {
	ID         uuid.UUID              `json:"id"`
	StrategyID uuid.UUID              `json:"strategy_id"`
	CustomName string                 `json:"custom_name"`
	Parameters map[string]interface{} `json:"parameters"`
	IsEnabled  bool                   `json:"is_enabled"`
	Priority   int                    `json:"priority"`
	Strategy   StrategyResponse       `json:"strategy"`
	CreatedAt  string                 `json:"created_at"`
	UpdatedAt  string                 `json:"updated_at"`
}

// ListStrategies returns all available strategies
func (h *StrategyHandler) ListStrategies(c *gin.Context) {
	strategyList, err := h.strategyRepo.List(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	items := make([]StrategyResponse, len(strategyList))
	for i, s := range strategyList {
		items[i] = toStrategyResponse(s)
	}

	c.JSON(http.StatusOK, items)
}

// GetStrategy returns a single strategy by ID
func (h *StrategyHandler) GetStrategy(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	strategy, err := h.strategyRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrStrategyNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, toStrategyResponse(*strategy))
}

// --- User Strategy Configuration Endpoints ---

// ConfigureStrategyRequest is the request for configuring a user strategy
type ConfigureStrategyRequest struct {
	StrategyID uuid.UUID              `json:"strategy_id" binding:"required"`
	CustomName string                 `json:"custom_name"`
	Parameters map[string]interface{} `json:"parameters"`
	IsEnabled  *bool                  `json:"is_enabled"`
	Priority   *int                   `json:"priority"`
}

// UpdateUserStrategyRequest is the request for updating a user strategy
type UpdateUserStrategyRequest struct {
	CustomName *string                `json:"custom_name"`
	Parameters map[string]interface{} `json:"parameters"`
	IsEnabled  *bool                  `json:"is_enabled"`
	Priority   *int                   `json:"priority"`
}

// ListUserStrategies returns user's configured strategies
func (h *StrategyHandler) ListUserStrategies(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userStrategies, err := h.strategyRepo.ListUserStrategies(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	items := make([]UserStrategyResponse, len(userStrategies))
	for i, us := range userStrategies {
		items[i] = toUserStrategyResponse(us)
	}

	c.JSON(http.StatusOK, items)
}

// ConfigureUserStrategy creates or updates a user's strategy configuration
func (h *StrategyHandler) ConfigureUserStrategy(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req ConfigureStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	// Verify strategy exists
	strategy, err := h.strategyRepo.GetByID(c.Request.Context(), req.StrategyID)
	if err != nil {
		if err == repository.ErrStrategyNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "Strategy not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	// Validate parameters using the registry
	if req.Parameters != nil {
		if registeredStrategy, ok := h.registry.Get(strategy.Name); ok {
			if err := registeredStrategy.Validate(req.Parameters); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "Invalid parameters"})
				return
			}
		}
	}

	// Check if already configured
	exists, _ := h.strategyRepo.UserHasStrategy(c.Request.Context(), userID, req.StrategyID)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "conflict", "message": "Strategy already configured"})
		return
	}

	userStrategy := &models.UserStrategy{
		UserID:     userID,
		StrategyID: req.StrategyID,
		CustomName: req.CustomName,
		Parameters: req.Parameters,
		IsEnabled:  true,
		Priority:   0,
	}

	if req.IsEnabled != nil {
		userStrategy.IsEnabled = *req.IsEnabled
	}
	if req.Priority != nil {
		userStrategy.Priority = *req.Priority
	}

	if err := h.strategyRepo.CreateUserStrategy(c.Request.Context(), userStrategy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	// Load with strategy relationship
	userStrategy.Strategy = *strategy

	c.JSON(http.StatusCreated, toUserStrategyResponse(*userStrategy))
}

// UpdateUserStrategy updates a user's strategy configuration
func (h *StrategyHandler) UpdateUserStrategy(c *gin.Context) {
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

	var req UpdateUserStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	// Get existing configuration
	userStrategy, err := h.strategyRepo.GetUserStrategyByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrUserStrategyNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	// Verify ownership
	if userStrategy.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// Validate parameters if provided
	if req.Parameters != nil {
		if registeredStrategy, ok := h.registry.Get(userStrategy.Strategy.Name); ok {
			if err := registeredStrategy.Validate(req.Parameters); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "Invalid parameters"})
				return
			}
		}
	}

	// Apply updates
	if req.CustomName != nil {
		userStrategy.CustomName = *req.CustomName
	}
	if req.Parameters != nil {
		userStrategy.Parameters = req.Parameters
	}
	if req.IsEnabled != nil {
		userStrategy.IsEnabled = *req.IsEnabled
	}
	if req.Priority != nil {
		userStrategy.Priority = *req.Priority
	}

	if err := h.strategyRepo.UpdateUserStrategy(c.Request.Context(), userStrategy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, toUserStrategyResponse(*userStrategy))
}

// DeleteUserStrategy removes a user's strategy configuration
func (h *StrategyHandler) DeleteUserStrategy(c *gin.Context) {
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
	userStrategy, err := h.strategyRepo.GetUserStrategyByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrUserStrategyNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	if userStrategy.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if err := h.strategyRepo.DeleteUserStrategy(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Strategy configuration deleted"})
}

// Helper functions

func toStrategyResponse(s models.Strategy) StrategyResponse {
	return StrategyResponse{
		ID:          s.ID,
		Name:        s.Name,
		DisplayName: s.DisplayName,
		Description: s.Description,
		Category:    s.Category,
		Parameters:  s.Parameters,
		IsSystem:    s.IsSystem,
		IsActive:    s.IsActive,
	}
}

func toUserStrategyResponse(us models.UserStrategy) UserStrategyResponse {
	return UserStrategyResponse{
		ID:         us.ID,
		StrategyID: us.StrategyID,
		CustomName: us.CustomName,
		Parameters: us.Parameters,
		IsEnabled:  us.IsEnabled,
		Priority:   us.Priority,
		Strategy:   toStrategyResponse(us.Strategy),
		CreatedAt:  us.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:  us.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

