package strategies

import (
	"context"
	"math"
	"time"

	"github.com/growvest/stock-screener/internal/models"
)

// AVWAPProximityStrategy identifies stocks trading near their Anchored VWAP
// This matches the Python implementation: stocks within ±tolerance of AVWAP
// anchored from a significant date (default: COVID crash low, 2020-03-22).
type AVWAPProximityStrategy struct {
	BaseStrategy
}

// NewAVWAPProximityStrategy creates a new AVWAP Proximity strategy
func NewAVWAPProximityStrategy() *AVWAPProximityStrategy {
	return &AVWAPProximityStrategy{
		BaseStrategy: BaseStrategy{
			name:        "avwap_proximity",
			displayName: "AVWAP Proximity",
			description: "Identifies stocks trading within a specified tolerance of their Anchored Volume Weighted Average Price. AVWAP from a significant date often acts as support/resistance.",
			category:    "technical",
		},
	}
}

// DefaultParams returns the default parameters for this strategy
func (s *AVWAPProximityStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"anchor_date": "2020-03-22", // COVID crash low
		"tolerance":   0.05,         // 5% tolerance
		"min_volume":  100000.0,     // Minimum average volume
	}
}

// NeedsHistoricalData implements HistoricalDataNeeder interface.
// AVWAP requires historical data from the anchor date to compute the true Anchored VWAP.
func (s *AVWAPProximityStrategy) NeedsHistoricalData(params map[string]interface{}) (bool, time.Time) {
	anchorDateStr := GetStringParam(params, "anchor_date", "2020-03-22")
	anchorDate, err := time.Parse("2006-01-02", anchorDateStr)
	if err != nil {
		// Fallback to COVID crash date
		anchorDate = time.Date(2020, 3, 22, 0, 0, 0, 0, time.UTC)
	}
	return true, anchorDate
}

// Validate checks if the parameters are valid
func (s *AVWAPProximityStrategy) Validate(params map[string]interface{}) error {
	tolerance := GetFloatParam(params, "tolerance", 0.05)
	if tolerance <= 0 || tolerance > 1 {
		return ErrInvalidParams
	}

	anchorDateStr := GetStringParam(params, "anchor_date", "2020-03-22")
	if _, err := time.Parse("2006-01-02", anchorDateStr); err != nil {
		return ErrInvalidParams
	}

	return nil
}

// Execute runs the AVWAP Proximity strategy.
// Logic matches the Python implementation:
//   - Fetch historical data from anchor_date to now
//   - Calculate AVWAP = cumulative(typical_price * volume) / cumulative(volume)
//   - If abs(price_diff%) <= tolerance, the stock matches
//   - Score = closeness to AVWAP (higher = closer = better)
func (s *AVWAPProximityStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	// Check for cancellation
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// Get parameters
	tolerance := GetFloatParam(params, "tolerance", 0.05)
	anchorDateStr := GetStringParam(params, "anchor_date", "2020-03-22")
	minVolume := GetFloatParam(params, "min_volume", 100000)

	// Get current price
	currentPrice := data.LastClose()

	if currentPrice <= 0 {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// We need sufficient historical data to calculate a meaningful AVWAP.
	// If we don't have enough data, skip this stock (don't fall back to daily VWAP
	// which is a completely different indicator and produces misleading results).
	if data.Len() < 20 {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
			ResultData: map[string]interface{}{
				"error": "Insufficient historical data for AVWAP calculation",
				"data_points": data.Len(),
			},
		}, nil
	}

	// Parse anchor date
	anchorDate, err := time.Parse("2006-01-02", anchorDateStr)
	if err != nil {
		return nil, ErrInvalidParams
	}

	// Filter data from anchor date onwards (matching Python: data[data.index >= anchor_date])
	filteredData := data.FilterFromDate(anchorDate)
	if filteredData.Len() == 0 {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
			ResultData: map[string]interface{}{
				"error": "No data available from anchor date",
				"anchor_date": anchorDateStr,
			},
		}, nil
	}

	// Calculate AVWAP from anchor date to latest
	// This matches Python: typical_price = (H+L+C)/3, then cumulative volume-weighted average
	avwap := s.calculateAVWAP(filteredData)
	if avwap <= 0 {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Check minimum volume using 20-day average from historical data.
	// We use average instead of latest because the live NSE quote (appended as
	// last data point) may have pre-market volume which is very low after hours.
	tail20 := data.Tail(20)
	avgVolume := Mean(tail20.Volume)
	if avgVolume < minVolume {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Calculate price difference from AVWAP as percentage
	// Matches Python: price_diff = ((current_price - avwap) / avwap) * 100
	priceDiffPct := ((currentPrice - avwap) / avwap) * 100
	tolerancePct := tolerance * 100 // Convert 0.05 to 5.0

	// Check if within tolerance - matching Python: abs(price_diff) <= tolerance * 100
	if math.Abs(priceDiffPct) > tolerancePct {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Stock is within tolerance of AVWAP - it's a match!
	// Score: higher = closer to AVWAP = better (inverted from Python's abs(price_diff))
	// Python uses abs(price_diff) where lower = better
	// We use (1 - abs/tolerance) * 100 so higher = better for UI sorting
	score := (1 - math.Abs(priceDiffPct)/tolerancePct) * 100

	// Signal: buy for stocks near AVWAP (both above and below = support zone)
	signal := models.SignalBuy

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        math.Round(score*100) / 100,
		Signal:       signal,
		Matched:      true, // Within tolerance = matched
		ResultData: map[string]interface{}{
			"avwap":            math.Round(avwap*100) / 100,
			"difference_pct":   math.Round(priceDiffPct*100) / 100,
			"volume_avg_20d":   math.Round(avgVolume),
			"date_latest":      data.LastDate().Format("2006-01-02"),
			"anchor_date":      anchorDateStr,
			"data_points_used": filteredData.Len(),
		},
	}, nil
}

// calculateAVWAP computes the Anchored Volume Weighted Average Price
// Matches Python implementation:
//
//	typical_price = (High + Low + Close) / 3
//	volume_price = typical_price * Volume
//	AVWAP = cumsum(volume_price) / cumsum(Volume)  [last value]
func (s *AVWAPProximityStrategy) calculateAVWAP(data *StockData) float64 {
	if data.Len() == 0 {
		return 0
	}

	var cumVolumePrice float64
	var cumVolume float64

	for i := 0; i < data.Len(); i++ {
		// Typical price = (High + Low + Close) / 3
		typicalPrice := (data.High[i] + data.Low[i] + data.Close[i]) / 3
		volume := data.Volume[i]

		cumVolumePrice += typicalPrice * volume
		cumVolume += volume
	}

	if cumVolume == 0 {
		return 0
	}

	return cumVolumePrice / cumVolume
}
