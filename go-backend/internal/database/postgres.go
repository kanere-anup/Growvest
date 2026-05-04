package database

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/growvest/stock-screener/internal/config"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/rs/zerolog/log"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB is the global database instance
var DB *gorm.DB

// Connect establishes a connection to the PostgreSQL database
func Connect(cfg *config.DatabaseConfig) (*gorm.DB, error) {
	dsn := cfg.DSN()

	// Configure GORM logger
	gormLogger := logger.Default.LogMode(logger.Silent)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                                   gormLogger,
		DisableForeignKeyConstraintWhenMigrating: false,
		PrepareStmt:                              true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// Connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

	// Verify connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	DB = db
	log.Info().Msg("Database connection established")

	return db, nil
}

// AutoMigrate runs automatic migrations for all models
func AutoMigrate(db *gorm.DB) error {
	log.Info().Msg("Running database migrations...")

	// Enable UUID extension
	if err := db.Exec("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\"").Error; err != nil {
		log.Warn().Err(err).Msg("Could not create pgcrypto extension")
	}

	// Migrate models in order (respecting foreign key dependencies)
	err := db.AutoMigrate(
		&models.User{},
		&models.RefreshSession{},
		&models.Stock{},
		&models.UserStock{},
		&models.Strategy{},
		&models.UserStrategy{},
		&models.Scan{},
		&models.ScanStock{},
		&models.ScanStrategy{},
		&models.ScanResult{},
		&models.Report{},
	)
	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Create additional indexes for performance
	createIndexes(db)

	log.Info().Msg("Database migrations completed")
	return nil
}

// createIndexes creates additional indexes for query optimization
func createIndexes(db *gorm.DB) {
	indexes := []string{
		// Composite indexes for common queries
		"CREATE INDEX IF NOT EXISTS idx_scan_results_scan_strategy ON scan_results(scan_id, strategy_id)",
		"CREATE INDEX IF NOT EXISTS idx_scan_results_scan_stock ON scan_results(scan_id, stock_id)",
		"CREATE INDEX IF NOT EXISTS idx_user_stocks_user_stock ON user_stocks(user_id, stock_id)",
		"CREATE INDEX IF NOT EXISTS idx_user_strategies_user_strategy ON user_strategies(user_id, strategy_id)",
		"CREATE INDEX IF NOT EXISTS idx_scans_user_status ON scans(user_id, status)",
		"CREATE INDEX IF NOT EXISTS idx_scan_results_created_at ON scan_results(created_at)",
		"CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_revoked ON refresh_sessions(user_id, revoked_at)",
	}

	for _, idx := range indexes {
		if err := db.Exec(idx).Error; err != nil {
			log.Warn().Err(err).Str("index", idx).Msg("Could not create index")
		}
	}
}

// SeedStrategies inserts the default system strategies
func SeedStrategies(db *gorm.DB) error {
	strategies := []models.Strategy{
		{
			Name:        "avwap_proximity",
			DisplayName: "AVWAP Proximity",
			Description: "Identifies stocks trading within ±5% of Anchored Volume Weighted Average Price. Useful for finding potential support/resistance levels.",
			Category:    "technical",
			IsSystem:    true,
			IsActive:    true,
			Parameters: models.JSONB{
				"anchor_date": "2020-03-22",
				"tolerance":   0.05,
				"min_volume":  100000,
			},
		},
		{
			Name:        "week_52_extremes",
			DisplayName: "52-Week Extremes",
			Description: "Finds stocks trading near their 52-week high or low (within 2%). These levels often act as significant support/resistance.",
			Category:    "technical",
			IsSystem:    true,
			IsActive:    true,
			Parameters: models.JSONB{
				"threshold":     0.02,
				"lookback_days": 252,
			},
		},
		{
			Name:        "volume_breakout",
			DisplayName: "Volume Breakout",
			Description: "Detects stocks with volume 2x or more above their 20-day average. High volume often precedes significant price moves.",
			Category:    "technical",
			IsSystem:    true,
			IsActive:    true,
			Parameters: models.JSONB{
				"multiplier": 2.0,
				"avg_period": 20,
				"min_volume": 100000,
			},
		},
		{
			Name:        "momentum",
			DisplayName: "Momentum Stocks",
			Description: "Identifies stocks with strong recent performance across multiple timeframes (5, 10, and 20 days).",
			Category:    "technical",
			IsSystem:    true,
			IsActive:    true,
			Parameters: models.JSONB{
				"threshold_5d":  3.0,
				"threshold_10d": 5.0,
				"threshold_20d": 10.0,
			},
		},
	}

	for _, strategy := range strategies {
		// Check if strategy already exists
		var existing models.Strategy
		result := db.Where("name = ?", strategy.Name).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&strategy).Error; err != nil {
				log.Warn().Err(err).Str("strategy", strategy.Name).Msg("Failed to seed strategy")
			} else {
				log.Info().Str("strategy", strategy.Name).Msg("Seeded strategy")
			}
		}
	}

	return nil
}

// StockSeedData represents the structure of stocks.json
type StockSeedData struct {
	Exchanges map[string]ExchangeData `json:"exchanges"`
}

// ExchangeData represents stocks for an exchange
type ExchangeData struct {
	Suffix string      `json:"suffix"`
	Stocks []StockData `json:"stocks"`
}

// StockData represents a single stock entry
type StockData struct {
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
	Sector string `json:"sector"`
}

// SeedStocks inserts stocks from data/stocks.json if table is empty
func SeedStocks(db *gorm.DB) error {
	var count int64
	db.Model(&models.Stock{}).Count(&count)
	if count > 0 {
		log.Debug().Int64("existing", count).Msg("Stocks already exist, skipping seed")
		return nil
	}

	// Try to load from JSON file
	seedData, err := loadStockSeedData()
	if err != nil {
		log.Warn().Err(err).Msg("Could not load stocks.json, using default list")
		return seedDefaultStocks(db)
	}

	totalSeeded := 0
	for exchangeName, exchangeData := range seedData.Exchanges {
		for _, stockData := range exchangeData.Stocks {
			stock := models.Stock{
				Symbol:   stockData.Symbol,
				Name:     stockData.Name,
				Exchange: exchangeName,
				Sector:   stockData.Sector,
				IsActive: true,
			}
			if err := db.Create(&stock).Error; err != nil {
				log.Warn().Err(err).Str("symbol", stockData.Symbol).Msg("Failed to seed stock")
			} else {
				totalSeeded++
			}
		}
	}

	log.Info().Int("count", totalSeeded).Msg("Seeded stocks from stocks.json")
	return nil
}

// loadStockSeedData loads stock data from JSON file
func loadStockSeedData() (*StockSeedData, error) {
	// Try multiple paths
	paths := []string{
		"data/stocks.json",
		"./data/stocks.json",
		"../data/stocks.json",
		"../../data/stocks.json",
	}

	var data []byte
	var err error
	for _, path := range paths {
		data, err = os.ReadFile(path)
		if err == nil {
			break
		}
	}
	if err != nil {
		return nil, err
	}

	var seedData StockSeedData
	if err := json.Unmarshal(data, &seedData); err != nil {
		return nil, err
	}

	return &seedData, nil
}

// seedDefaultStocks seeds using hardcoded defaults as fallback
func seedDefaultStocks(db *gorm.DB) error {
	nseSymbols := []string{
		"RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR",
		"ICICIBANK", "KOTAKBANK", "BHARTIARTL", "ITC", "SBIN",
		"LT", "ASIANPAINT", "AXISBANK", "MARUTI", "BAJFINANCE",
		"HCLTECH", "WIPRO", "ULTRACEMCO", "ADANIPORTS", "ONGC",
		"TATAMOTORS", "SUNPHARMA", "JSWSTEEL", "TATASTEEL", "POWERGRID",
		"NTPC", "TECHM", "TITAN", "NESTLEIND", "COALINDIA",
	}

	for _, symbol := range nseSymbols {
		stock := models.Stock{
			Symbol:   symbol,
			Exchange: "NSE",
			IsActive: true,
		}
		if err := db.Create(&stock).Error; err != nil {
			log.Warn().Err(err).Str("symbol", symbol).Msg("Failed to seed stock")
		}
	}

	log.Info().Int("count", len(nseSymbols)).Msg("Seeded stocks (default list)")
	return nil
}

// Close closes the database connection
func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
