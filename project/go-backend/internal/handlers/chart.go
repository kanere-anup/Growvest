package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
	"github.com/growvest/stock-screener/internal/services/marketdata"
	"github.com/growvest/stock-screener/pkg/logger"
)

type ChartHandler struct {
	marketData     *marketdata.NSEService
	stockRepo      *repository.StockRepository
	stockPriceRepo *repository.StockPriceRepository
	log            *logger.Logger
}

func NewChartHandler(
	marketData *marketdata.NSEService,
	stockRepo *repository.StockRepository,
	stockPriceRepo *repository.StockPriceRepository,
	log *logger.Logger,
) *ChartHandler {
	return &ChartHandler{
		marketData:     marketData,
		stockRepo:      stockRepo,
		stockPriceRepo: stockPriceRepo,
		log:            log,
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
	toDate := time.Now()

	// Try to get data from DB first, then fill gaps from Yahoo
	points, err := h.getHistoricalDataWithPersistence(c, symbol, fromDate, toDate)
	if err != nil || len(points) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "data_error", "message": "No market data available for " + symbol})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"symbol": symbol,
		"points": points,
		"count":  len(points),
	})
}

// getHistoricalDataWithPersistence fetches data from DB, identifies gaps, fills from Yahoo, stores new data
func (h *ChartHandler) getHistoricalDataWithPersistence(c *gin.Context, symbol string, from, to time.Time) ([]OHLCVPoint, error) {
	ctx := c.Request.Context()

	// Check what we have in DB
	dbPrices, err := h.stockPriceRepo.GetBySymbolDateRange(ctx, symbol, from, to)
	if err != nil {
		h.log.Warn().Err(err).Str("symbol", symbol).Msg("Failed to query DB for stock prices")
	}

	// Determine what ranges need fetching from Yahoo
	needsFetch := false
	var fetchFrom, fetchTo time.Time

	if len(dbPrices) == 0 {
		// No data in DB at all — fetch everything
		needsFetch = true
		fetchFrom = from
		fetchTo = to
	} else {
		// We have some data. Check if we need older data or newer data.
		dbEarliest := dbPrices[0].Date
		dbLatest := dbPrices[len(dbPrices)-1].Date

		// Need older data?
		if from.Before(dbEarliest.AddDate(0, 0, -1)) {
			needsFetch = true
			fetchFrom = from
			fetchTo = to // Just fetch the whole range to be safe
		}

		// Need newer data? (if latest DB data is more than 1 day old)
		today := time.Now().Truncate(24 * time.Hour)
		if dbLatest.Before(today.AddDate(0, 0, -1)) {
			needsFetch = true
			if fetchFrom.IsZero() {
				// Only need newer data — fetch from day after latest DB date
				fetchFrom = dbLatest.AddDate(0, 0, 1)
			}
			fetchTo = to
		}
	}

	if needsFetch {
		h.log.Info().Str("symbol", symbol).
			Time("from", fetchFrom).Time("to", fetchTo).
			Msg("Fetching missing stock price data from Yahoo")

		yahooData, err := h.marketData.GetHistoricalData(ctx, symbol, fetchFrom, fetchTo)
		if err != nil {
			h.log.Warn().Err(err).Str("symbol", symbol).Msg("Failed to fetch from Yahoo Finance")
			// If we have partial DB data, use what we have
			if len(dbPrices) > 0 {
				return dbPricesToPoints(dbPrices, from), nil
			}
			return nil, err
		}

		// Store fetched data in DB
		if len(yahooData) > 0 {
			h.persistPriceData(ctx, symbol, yahooData)

			// Re-query DB for the full date range to get a clean sorted result
			dbPrices, err = h.stockPriceRepo.GetBySymbolDateRange(ctx, symbol, from, to)
			if err != nil {
				h.log.Warn().Err(err).Str("symbol", symbol).Msg("Failed to re-query DB after persisting")
				// Fall back to Yahoo data directly
				return yahooDataToPoints(yahooData, from), nil
			}
		}
	}

	return dbPricesToPoints(dbPrices, from), nil
}

// persistPriceData stores Yahoo historical data into the stock_prices table
func (h *ChartHandler) persistPriceData(ctx context.Context, symbol string, data []marketdata.HistoricalData) {
	// Look up the stock ID
	stock, err := h.stockRepo.GetBySymbol(ctx, symbol)
	if err != nil {
		h.log.Warn().Err(err).Str("symbol", symbol).Msg("Stock not found in DB, skipping price persistence")
		return
	}

	prices := make([]models.StockPrice, 0, len(data))
	for _, d := range data {
		prices = append(prices, models.StockPrice{
			ID:       uuid.New(),
			StockID:  stock.ID,
			Symbol:   symbol,
			Date:     d.Date,
			Open:     d.Open,
			High:     d.High,
			Low:      d.Low,
			Close:    d.Close,
			Volume:   d.Volume,
			AdjClose: d.Close,
		})
	}

	if err := h.stockPriceRepo.BulkUpsert(ctx, prices); err != nil {
		h.log.Warn().Err(err).Str("symbol", symbol).Int("count", len(prices)).Msg("Failed to persist stock prices")
	} else {
		h.log.Info().Str("symbol", symbol).Int("count", len(prices)).Msg("Persisted stock price data")
	}
}

// dbPricesToPoints converts DB models to API response format, filtering by date
func dbPricesToPoints(prices []models.StockPrice, from time.Time) []OHLCVPoint {
	points := make([]OHLCVPoint, 0, len(prices))
	for _, p := range prices {
		if p.Date.Before(from) {
			continue
		}
		points = append(points, OHLCVPoint{
			Date:   p.Date.Format("2006-01-02"),
			Open:   p.Open,
			High:   p.High,
			Low:    p.Low,
			Close:  p.Close,
			Volume: p.Volume,
		})
	}
	return points
}

// yahooDataToPoints converts Yahoo data directly to API response (fallback)
func yahooDataToPoints(data []marketdata.HistoricalData, from time.Time) []OHLCVPoint {
	points := make([]OHLCVPoint, 0, len(data))
	for _, d := range data {
		if d.Date.Before(from) {
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
	return points
}
