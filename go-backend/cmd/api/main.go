package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/growvest/stock-screener/internal/auth"
	"github.com/growvest/stock-screener/internal/config"
	"github.com/growvest/stock-screener/internal/database"
	"github.com/growvest/stock-screener/internal/handlers"
	"github.com/growvest/stock-screener/internal/middleware"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
	"github.com/growvest/stock-screener/internal/services/marketdata"
	"github.com/growvest/stock-screener/internal/services/scanner"
	"github.com/growvest/stock-screener/internal/services/strategies"
	"github.com/growvest/stock-screener/pkg/logger"
)

func main() {
	// Initialize logger
	log := logger.New(logger.Config{
		Level:  "debug",
		Format: "console",
	})

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Update logger with config level
	log = logger.New(logger.Config{
		Level:  cfg.App.LogLevel,
		Format: "console",
	})

	log.Info().
		Str("env", cfg.App.Env).
		Str("port", cfg.Server.Port).
		Msg("Starting Growvest Stock Screener API")

	// Connect to database
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer database.Close(db)
	log.Info().Msg("Database connection established")

	// Run migrations
	if err := database.AutoMigrate(db); err != nil {
		log.Fatal().Err(err).Msg("Failed to run migrations")
	}
	log.Info().Msg("Database migrations completed")

	// Seed data
	if err := database.SeedStrategies(db); err != nil {
		log.Warn().Err(err).Msg("Failed to seed strategies")
	}
	if err := database.SeedStocks(db); err != nil {
		log.Warn().Err(err).Msg("Failed to seed stocks")
	}

	// Initialize strategy registry
	strategies.InitDefaultStrategies()
	log.Info().Int("count", strategies.DefaultRegistry.Count()).Msg("Strategy registry initialized")

	// Initialize JWT manager
	jwtManager, err := auth.NewJWTManager(&cfg.JWT)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize JWT manager")
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	stockRepo := repository.NewStockRepository(db)
	strategyRepo := repository.NewStrategyRepository(db)
	scanRepo := repository.NewScanRepository(db)
	log.Debug().Msg("Repositories initialized")

	// Initialize market data service
	nseService := marketdata.NewNSEService(log)
	log.Info().Msg("NSE market data service initialized")

	// Initialize scan executor
	scanExecutor := scanner.NewScanExecutor(
		scanRepo,
		stockRepo,
		strategyRepo,
		nseService,
		strategies.DefaultRegistry,
		log,
		scanner.ExecutorConfig{
			WorkerCount: 3,
			QueueSize:   100,
		},
	)

	// Start scan executor in background
	ctx, cancelExecutor := context.WithCancel(context.Background())
	scanExecutor.Start(ctx)
	log.Info().Msg("Scan executor started")

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(userRepo, jwtManager, cfg)
	stockHandler := handlers.NewStockHandler(stockRepo)
	strategyHandler := handlers.NewStrategyHandler(strategyRepo, strategies.DefaultRegistry)
	scanHandler := handlers.NewScanHandler(scanRepo, stockRepo, strategyRepo, scanExecutor, log)
	healthHandler := handlers.NewHealthHandler(db)

	// Setup Gin
	gin.SetMode(cfg.Server.GinMode)
	router := gin.New()

	// Apply global middleware
	router.Use(middleware.RecoveryMiddleware())
	router.Use(middleware.LoggerMiddleware())
	router.Use(middleware.CORSMiddleware(&cfg.CORS))

	// Health endpoints (no auth required)
	router.GET("/health", healthHandler.Health)
	router.GET("/ready", healthHandler.Ready)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Auth routes (no auth required)
		authGroup := v1.Group("/auth")
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/refresh", authHandler.Refresh)
			authGroup.POST("/logout", authHandler.Logout)
			authGroup.GET("/me", middleware.AuthMiddleware(jwtManager, &cfg.JWT), authHandler.Me)
		}

		// Protected routes (all authenticated users)
		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware(jwtManager, &cfg.JWT))
		protected.Use(middleware.CSRFMiddleware(&cfg.JWT))
		{
			// Stocks - Read-only for all users
			protected.GET("/stocks", stockHandler.ListStocks)
			protected.GET("/stocks/:id", stockHandler.GetStock)

			// User watchlist
			protected.GET("/my-stocks", stockHandler.GetWatchlist)
			protected.POST("/my-stocks", stockHandler.AddToWatchlist)
			protected.DELETE("/my-stocks/:id", stockHandler.RemoveFromWatchlist)

			// Strategies - Read-only
			protected.GET("/strategies", strategyHandler.ListStrategies)
			protected.GET("/strategies/:id", strategyHandler.GetStrategy)

			// User strategies
			protected.GET("/my-strategies", strategyHandler.ListUserStrategies)
			protected.POST("/my-strategies", strategyHandler.ConfigureUserStrategy)
			protected.PUT("/my-strategies/:id", strategyHandler.UpdateUserStrategy)
			protected.DELETE("/my-strategies/:id", strategyHandler.DeleteUserStrategy)

			// Scans
			protected.POST("/scans", scanHandler.StartScan)
			protected.GET("/scans", scanHandler.ListScans)
			protected.GET("/scans/:id", scanHandler.GetScan)
			protected.GET("/scans/:id/status", scanHandler.GetScanStatus)
			protected.GET("/scans/:id/results", scanHandler.GetScanResults)
			protected.GET("/scans/:id/export", scanHandler.ExportScanResults)
			protected.DELETE("/scans/:id", scanHandler.DeleteScan)

			// Analytics
			protected.GET("/analytics/performance", scanHandler.GetAnalytics)
			protected.GET("/analytics/top-stocks", scanHandler.GetTopStocks)
		}

		// Admin-only routes
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(jwtManager, &cfg.JWT))
		admin.Use(middleware.CSRFMiddleware(&cfg.JWT))
		admin.Use(middleware.RequireRole(models.RoleAdmin))
		{
			// Stocks - CRUD for admin only
			admin.POST("/stocks", stockHandler.CreateStock)
			admin.PUT("/stocks/:id", stockHandler.UpdateStock)
			admin.DELETE("/stocks/:id", stockHandler.DeleteStock)
		}
	}

	// Create server
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info().Str("addr", srv.Addr).Msg("HTTP server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("HTTP server failed")
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	// Stop scan executor
	cancelExecutor()
	scanExecutor.Stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server stopped")
}
