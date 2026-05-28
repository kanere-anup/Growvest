package stocksync

import (
	"context"
	"time"

	"github.com/growvest/stock-screener/pkg/logger"
)

// Scheduler runs stock sync on a configurable interval
type Scheduler struct {
	syncService *StockSyncService
	interval    time.Duration
	logger      *logger.Logger
	cancel      context.CancelFunc
}

// NewScheduler creates a scheduler that triggers stock sync periodically
func NewScheduler(syncService *StockSyncService, interval time.Duration, log *logger.Logger) *Scheduler {
	return &Scheduler{
		syncService: syncService,
		interval:    interval,
		logger:      log.WithComponent("stock_sync_scheduler"),
	}
}

// Start begins the scheduler. It runs an initial sync after a short delay,
// then repeats at the configured interval (e.g., every 24 hours).
func (s *Scheduler) Start(ctx context.Context) {
	ctx, s.cancel = context.WithCancel(ctx)

	go func() {
		// Delay initial sync by 30 seconds to let the server fully start up
		s.logger.Info().
			Str("interval", s.interval.String()).
			Msg("Stock sync scheduler started, initial sync in 30s")

		select {
		case <-time.After(30 * time.Second):
		case <-ctx.Done():
			return
		}

		// Run initial sync
		s.runSync(ctx)

		// Then run on interval
		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.runSync(ctx)
			case <-ctx.Done():
				s.logger.Info().Msg("Stock sync scheduler stopped")
				return
			}
		}
	}()
}

// Stop cancels the scheduler
func (s *Scheduler) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
}

func (s *Scheduler) runSync(ctx context.Context) {
	if s.syncService.IsRunning() {
		s.logger.Info().Msg("Skipping scheduled sync - already running")
		return
	}

	s.logger.Info().Msg("Starting scheduled stock sync")

	result, err := s.syncService.SyncAll(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("Scheduled stock sync failed")
		return
	}

	s.logger.Info().
		Int("new", result.NewStocks).
		Int("updated", result.Updated).
		Int("delisted", result.Delisted).
		Int("errors", result.Errors).
		Str("duration", result.Duration).
		Msg("Scheduled stock sync completed")
}
