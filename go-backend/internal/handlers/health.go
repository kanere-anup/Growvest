package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	db *gorm.DB
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

// Health returns the health status of the application
func (h *HealthHandler) Health(c *gin.Context) {
	// Check database connection
	sqlDB, err := h.db.DB()
	dbStatus := "healthy"
	if err != nil {
		dbStatus = "unhealthy"
	} else if err := sqlDB.Ping(); err != nil {
		dbStatus = "unhealthy"
	}

	status := http.StatusOK
	overallStatus := "healthy"
	if dbStatus == "unhealthy" {
		status = http.StatusServiceUnavailable
		overallStatus = "unhealthy"
	}

	c.JSON(status, gin.H{
		"status": overallStatus,
		"services": gin.H{
			"database": dbStatus,
		},
	})
}

// Ready returns whether the application is ready to receive traffic
func (h *HealthHandler) Ready(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}

