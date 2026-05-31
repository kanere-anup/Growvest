package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/growvest/stock-screener/internal/repository"
	"github.com/growvest/stock-screener/internal/services/backtest"
	"github.com/growvest/stock-screener/internal/services/cache"
	"github.com/growvest/stock-screener/internal/services/marketdata"
	"github.com/growvest/stock-screener/internal/services/strategies"
	"github.com/growvest/stock-screener/pkg/logger"
)

type BacktestHandler struct {
	engine     *backtest.Engine
	stockRepo  *repository.StockRepository
	marketData *marketdata.NSEService
	cache      *cache.RedisCache
	registry   *strategies.Registry
	log        *logger.Logger
}

func NewBacktestHandler(
	engine *backtest.Engine,
	stockRepo *repository.StockRepository,
	marketData *marketdata.NSEService,
	redisCache *cache.RedisCache,
	registry *strategies.Registry,
	log *logger.Logger,
) *BacktestHandler {
	return &BacktestHandler{
		engine:     engine,
		stockRepo:  stockRepo,
		marketData: marketData,
		cache:      redisCache,
		registry:   registry,
		log:        log,
	}
}

type BacktestRequest struct {
	Symbol         string                 `json:"symbol" binding:"required"`
	StrategyName   string                 `json:"strategy_name" binding:"required"`
	Parameters     map[string]interface{} `json:"parameters"`
	InitialCapital float64                `json:"initial_capital"`
	LookbackDays   int                    `json:"lookback_days"`
}

func (h *BacktestHandler) RunBacktest(c *gin.Context) {
	var req BacktestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	if req.InitialCapital <= 0 {
		req.InitialCapital = 100000
	}
	if req.LookbackDays <= 0 {
		req.LookbackDays = 365
	}

	strategy, ok := h.registry.Get(req.StrategyName)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_strategy", "message": "Strategy not found"})
		return
	}

	params := req.Parameters
	if params == nil {
		params = strategy.DefaultParams()
	}

	fromDate := time.Now().AddDate(0, 0, -req.LookbackDays)
	toDate := time.Now()

	// Always fetch fresh data for backtesting — no caching to ensure
	// different lookback periods always produce accurate results
	historicalData, err := h.marketData.GetHistoricalData(c.Request.Context(), req.Symbol, fromDate, toDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "data_error", "message": "Failed to fetch market data for " + req.Symbol})
		return
	}

	stockData := &strategies.StockData{
		Symbol:   req.Symbol,
		Dates:    make([]time.Time, len(historicalData)),
		Open:     make([]float64, len(historicalData)),
		High:     make([]float64, len(historicalData)),
		Low:      make([]float64, len(historicalData)),
		Close:    make([]float64, len(historicalData)),
		Volume:   make([]float64, len(historicalData)),
		AdjClose: make([]float64, len(historicalData)),
	}
	for i, d := range historicalData {
		stockData.Dates[i] = d.Date
		stockData.Open[i] = d.Open
		stockData.High[i] = d.High
		stockData.Low[i] = d.Low
		stockData.Close[i] = d.Close
		stockData.Volume[i] = float64(d.Volume)
		stockData.AdjClose[i] = d.Close
	}

	result, err := h.engine.Run(c.Request.Context(), stockData, req.StrategyName, params, req.InitialCapital)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "backtest_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *BacktestHandler) ListStrategies(c *gin.Context) {
	c.JSON(http.StatusOK, h.registry.List())
}
