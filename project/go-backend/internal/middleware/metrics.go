package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "growvest_http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "growvest_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"method", "path"},
	)

	activeConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "growvest_active_connections",
			Help: "Number of active HTTP connections",
		},
	)

	ScanExecutionDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "growvest_scan_duration_seconds",
			Help:    "Scan execution duration in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
		},
		[]string{"status"},
	)

	ScanStocksProcessed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "growvest_scan_stocks_processed_total",
			Help: "Total stocks processed in scans",
		},
		[]string{"result"},
	)

	StrategyMatchesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "growvest_strategy_matches_total",
			Help: "Total strategy matches found",
		},
		[]string{"strategy", "signal"},
	)

	CacheHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "growvest_cache_hits_total",
			Help: "Cache hit/miss counts",
		},
		[]string{"type"},
	)
)

func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		activeConnections.Inc()
		start := time.Now()

		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		path := normalizePath(c.FullPath())

		httpRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		httpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
		activeConnections.Dec()
	}
}

func normalizePath(path string) string {
	if path == "" {
		return "unknown"
	}
	return path
}
