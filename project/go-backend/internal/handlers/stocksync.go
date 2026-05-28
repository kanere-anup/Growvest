package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/growvest/stock-screener/internal/services/stocksync"
	"github.com/growvest/stock-screener/pkg/logger"
)

// StockSyncHandler handles stock sync endpoints
type StockSyncHandler struct {
	syncService *stocksync.StockSyncService
	logger      *logger.Logger
}

// NewStockSyncHandler creates a new stock sync handler
func NewStockSyncHandler(syncService *stocksync.StockSyncService, log *logger.Logger) *StockSyncHandler {
	return &StockSyncHandler{
		syncService: syncService,
		logger:      log.WithComponent("stock_sync_handler"),
	}
}

// SyncStocks triggers a full stock sync from NSE/Yahoo Finance
func (h *StockSyncHandler) SyncStocks(c *gin.Context) {
	if h.syncService.IsRunning() {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "sync_in_progress",
			"message": "A stock sync is already running. Please wait for it to complete.",
		})
		return
	}

	// Use a detached context so the sync continues after request returns.
	// c.Request.Context() is cancelled when the handler returns 202,
	// which would abort all DB/HTTP calls in the background goroutine.
	bgCtx := context.Background()

	go func() {
		result, err := h.syncService.SyncAll(bgCtx)
		if err != nil {
			h.logger.Error().Err(err).Msg("Background stock sync failed")
			return
		}
		h.logger.Info().
			Int("new", result.NewStocks).
			Int("updated", result.Updated).
			Int("delisted", result.Delisted).
			Str("duration", result.Duration).
			Msg("Background stock sync completed")
	}()

	c.JSON(http.StatusAccepted, gin.H{
		"message": "Stock sync started in background",
		"status":  "running",
	})
}

// SyncStocksBlocking triggers a full stock sync and waits for completion
func (h *StockSyncHandler) SyncStocksBlocking(c *gin.Context) {
	if h.syncService.IsRunning() {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "sync_in_progress",
			"message": "A stock sync is already running.",
		})
		return
	}

	result, err := h.syncService.SyncAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "sync_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stock sync completed",
		"result":  result,
	})
}

// GetSyncStatus returns whether a sync is currently running
func (h *StockSyncHandler) GetSyncStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"is_running": h.syncService.IsRunning(),
	})
}
