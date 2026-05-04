package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/middleware"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
)

// StockHandler handles stock-related endpoints
type StockHandler struct {
	stockRepo *repository.StockRepository
}

// NewStockHandler creates a new stock handler
func NewStockHandler(stockRepo *repository.StockRepository) *StockHandler {
	return &StockHandler{stockRepo: stockRepo}
}

// CreateStockRequest is the request for creating a stock
type CreateStockRequest struct {
	Symbol    string                 `json:"symbol" binding:"required,max=20"`
	Exchange  string                 `json:"exchange"`
	Name      string                 `json:"name"`
	Sector    string                 `json:"sector"`
	MarketCap float64                `json:"market_cap"`
	IsActive  *bool                  `json:"is_active"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// UpdateStockRequest is the request for updating a stock
type UpdateStockRequest struct {
	Symbol    *string                `json:"symbol"`
	Exchange  *string                `json:"exchange"`
	Name      *string                `json:"name"`
	Sector    *string                `json:"sector"`
	MarketCap *float64               `json:"market_cap"`
	IsActive  *bool                  `json:"is_active"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// StockResponse is the response for stock data
type StockResponse struct {
	ID        uuid.UUID              `json:"id"`
	Symbol    string                 `json:"symbol"`
	Exchange  string                 `json:"exchange"`
	Name      string                 `json:"name"`
	Sector    string                 `json:"sector"`
	MarketCap float64                `json:"market_cap"`
	IsActive  bool                   `json:"is_active"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt string                 `json:"created_at"`
	UpdatedAt string                 `json:"updated_at"`
}

// ListStocks returns a paginated list of stocks
func (h *StockHandler) ListStocks(c *gin.Context) {
	var params struct {
		Limit    int    `form:"limit,default=50"`
		Offset   int    `form:"offset,default=0"`
		Active   *bool  `form:"active"`
		Exchange string `form:"exchange"`
		Sector   string `form:"sector"`
		Search   string `form:"search"`
	}
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_params", "message": err.Error()})
		return
	}

	// Cap limit
	if params.Limit > 200 {
		params.Limit = 200
	}

	opts := repository.ListOptions{
		Limit:    params.Limit,
		Offset:   params.Offset,
		Active:   params.Active,
		Exchange: params.Exchange,
		Sector:   params.Sector,
		Search:   params.Search,
		OrderBy:  "symbol",
	}

	stocks, total, err := h.stockRepo.List(c.Request.Context(), opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to list stocks"})
		return
	}

	items := make([]StockResponse, len(stocks))
	for i, s := range stocks {
		items[i] = toStockResponse(s)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  params.Limit,
		"offset": params.Offset,
	})
}

// GetStock returns a single stock by ID
func (h *StockHandler) GetStock(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id", "message": "Invalid stock ID"})
		return
	}

	stock, err := h.stockRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrStockNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "Stock not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to get stock"})
		return
	}

	c.JSON(http.StatusOK, toStockResponse(*stock))
}

// CreateStock creates a new stock
func (h *StockHandler) CreateStock(c *gin.Context) {
	var req CreateStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	stock := &models.Stock{
		Symbol:    req.Symbol,
		Exchange:  req.Exchange,
		Name:      req.Name,
		Sector:    req.Sector,
		MarketCap: req.MarketCap,
		IsActive:  true,
		Metadata:  req.Metadata,
	}

	if req.Exchange == "" {
		stock.Exchange = "NS" // Default to NSE
	}

	if req.IsActive != nil {
		stock.IsActive = *req.IsActive
	}

	if err := h.stockRepo.Create(c.Request.Context(), stock); err != nil {
		if err == repository.ErrStockAlreadyExists {
			c.JSON(http.StatusConflict, gin.H{"error": "conflict", "message": "Stock symbol already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to create stock"})
		return
	}

	c.JSON(http.StatusCreated, toStockResponse(*stock))
}

// UpdateStock updates an existing stock
func (h *StockHandler) UpdateStock(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id", "message": "Invalid stock ID"})
		return
	}

	var req UpdateStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	stock, err := h.stockRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		if err == repository.ErrStockNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "Stock not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to get stock"})
		return
	}

	// Apply updates
	if req.Symbol != nil {
		stock.Symbol = *req.Symbol
	}
	if req.Exchange != nil {
		stock.Exchange = *req.Exchange
	}
	if req.Name != nil {
		stock.Name = *req.Name
	}
	if req.Sector != nil {
		stock.Sector = *req.Sector
	}
	if req.MarketCap != nil {
		stock.MarketCap = *req.MarketCap
	}
	if req.IsActive != nil {
		stock.IsActive = *req.IsActive
	}
	if req.Metadata != nil {
		stock.Metadata = req.Metadata
	}

	if err := h.stockRepo.Update(c.Request.Context(), stock); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to update stock"})
		return
	}

	c.JSON(http.StatusOK, toStockResponse(*stock))
}

// DeleteStock soft-deletes a stock
func (h *StockHandler) DeleteStock(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id", "message": "Invalid stock ID"})
		return
	}

	if err := h.stockRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "Failed to delete stock"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stock deleted"})
}

// --- User Watchlist Endpoints ---

// AddToWatchlistRequest is the request for adding to watchlist
type AddToWatchlistRequest struct {
	StockID uuid.UUID `json:"stock_id" binding:"required"`
	Notes   string    `json:"notes"`
}

// GetWatchlist returns user's stock watchlist
func (h *StockHandler) GetWatchlist(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var params struct {
		Limit  int `form:"limit,default=50"`
		Offset int `form:"offset,default=0"`
	}
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_params"})
		return
	}

	userStocks, total, err := h.stockRepo.GetWatchlist(c.Request.Context(), userID, params.Limit, params.Offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	items := make([]gin.H, len(userStocks))
	for i, us := range userStocks {
		items[i] = gin.H{
			"id":          us.ID,
			"stock":       toStockResponse(us.Stock),
			"notes":       us.Notes,
			"is_favorite": us.IsFavorite,
			"created_at":  us.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  params.Limit,
		"offset": params.Offset,
	})
}

// AddToWatchlist adds a stock to user's watchlist
func (h *StockHandler) AddToWatchlist(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req AddToWatchlistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	// Check if already in watchlist
	exists, _ := h.stockRepo.IsInWatchlist(c.Request.Context(), userID, req.StockID)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "conflict", "message": "Stock already in watchlist"})
		return
	}

	userStock := &models.UserStock{
		UserID:  userID,
		StockID: req.StockID,
		Notes:   req.Notes,
	}

	if err := h.stockRepo.AddToWatchlist(c.Request.Context(), userStock); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Added to watchlist", "id": userStock.ID})
}

// RemoveFromWatchlist removes a stock from user's watchlist
func (h *StockHandler) RemoveFromWatchlist(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	stockID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	if err := h.stockRepo.RemoveFromWatchlist(c.Request.Context(), userID, stockID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Removed from watchlist"})
}

// Helper function to convert model to response
func toStockResponse(s models.Stock) StockResponse {
	return StockResponse{
		ID:        s.ID,
		Symbol:    s.Symbol,
		Exchange:  s.Exchange,
		Name:      s.Name,
		Sector:    s.Sector,
		MarketCap: s.MarketCap,
		IsActive:  s.IsActive,
		Metadata:  s.Metadata,
		CreatedAt: s.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt: s.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

