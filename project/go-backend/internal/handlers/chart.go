package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/growvest/stock-screener/internal/services/cache"
	"github.com/growvest/stock-screener/internal/services/marketdata"
	"github.com/growvest/stock-screener/pkg/logger"
)

type ChartHandler struct {
	marketData *marketdata.NSEService
	cache      *cache.RedisCache
	log        *logger.Logger
}

func NewChartHandler(marketData *marketdata.NSEService, redisCache *cache.RedisCache, log *logger.Logger) *ChartHandler {
	return &ChartHandler{
		marketData: marketData,
		cache:      redisCache,
		log:        log,
	}
}

type OHLCVPoint struct {
	Date   string  `json:"date"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume int64   `json:"volume"`
}

func (h *ChartHandler) GetChartData(c *gin.Context) {
	symbol := c.Query("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "Symbol is required"})
		return
	}

	days, _ := strconv.Atoi(c.DefaultQuery("days", "365"))
	if days < 7 {
		days = 7
	}
	if days > 3650 {
		days = 3650
	}

	fromDate := time.Now().AddDate(0, 0, -days)
	cacheKey := cache.MarketDataKey(symbol)

	var historicalData []marketdata.HistoricalData

	if h.cache != nil {
		_ = h.cache.Get(c.Request.Context(), cacheKey, &historicalData)
	}

	if len(historicalData) == 0 {
		var err error
		historicalData, err = h.marketData.GetHistoricalData(c.Request.Context(), symbol, fromDate, time.Now())
		if err != nil || len(historicalData) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "data_error", "message": "No market data available for " + symbol})
			return
		}
		if h.cache != nil {
			_ = h.cache.Set(c.Request.Context(), cacheKey, historicalData, 4*time.Hour)
		}
	}

	// Filter to requested date range
	points := make([]OHLCVPoint, 0, len(historicalData))
	for _, d := range historicalData {
		if d.Date.Before(fromDate) {
			continue
		}
		points = append(points, OHLCVPoint{
			Date:   d.Date.Format("2006-01-02"),
			Open:   d.Open,
			High:   d.High,
			Low:    d.Low,
			Close:  d.Close,
			Volume: d.Volume,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"symbol": symbol,
		"points": points,
		"count":  len(points),
	})
}
