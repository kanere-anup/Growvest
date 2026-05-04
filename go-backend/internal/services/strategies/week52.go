package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

// Week52ExtremesStrategy identifies stocks near their 52-week highs or lows
type Week52ExtremesStrategy struct {
	BaseStrategy
}

// NewWeek52ExtremesStrategy creates a new 52-Week Extremes strategy
func NewWeek52ExtremesStrategy() *Week52ExtremesStrategy {
	return &Week52ExtremesStrategy{
		BaseStrategy: BaseStrategy{
			name:        "week_52_extremes",
			displayName: "52-Week Extremes",
			description: "Finds stocks trading near their 52-week high or low. These levels often represent significant support/resistance zones.",
			category:    "technical",
		},
	}
}

// DefaultParams returns the default parameters for this strategy
func (s *Week52ExtremesStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"threshold":     0.02, // 2% from high/low
		"lookback_days": 252,  // Trading days in a year
	}
}

// Validate checks if the parameters are valid
func (s *Week52ExtremesStrategy) Validate(params map[string]interface{}) error {
	threshold := GetFloatParam(params, "threshold", 0.02)
	if threshold <= 0 || threshold > 0.5 {
		return ErrInvalidParams
	}

	lookbackDays := GetIntParam(params, "lookback_days", 252)
	if lookbackDays < 20 || lookbackDays > 500 {
		return ErrInvalidParams
	}

	return nil
}

// Execute runs the 52-Week Extremes strategy
func (s *Week52ExtremesStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	// Check for cancellation
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// Get parameters
	threshold := GetFloatParam(params, "threshold", 0.02)
	_ = GetIntParam(params, "lookback_days", 252) // Not used when we have pre-calculated 52W data

	// Get current price
	currentPrice := data.LastClose()
	if currentPrice <= 0 {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Try to get 52-week high/low from the data
	// The High array may contain [intraday_high, 52w_high] and Low may contain [intraday_low, 52w_low]
	var week52High, week52Low float64

	if len(data.High) >= 2 {
		// Use pre-calculated 52-week high from quote
		week52High = data.High[1]
	} else if len(data.High) > 0 {
		week52High = Max(data.High)
	}

	if len(data.Low) >= 2 {
		// Use pre-calculated 52-week low from quote
		week52Low = data.Low[1]
	} else if len(data.Low) > 0 {
		week52Low = Min(data.Low)
	}

	// Validate we have valid 52-week data
	if week52High <= 0 || week52Low <= 0 {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Calculate distances
	distFromHigh := (currentPrice - week52High) / week52High
	distFromLow := (currentPrice - week52Low) / week52Low

	// Check if near high or low
	nearHigh := math.Abs(distFromHigh) <= threshold
	nearLow := distFromLow <= threshold

	if !nearHigh && !nearLow {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Determine extreme type and signal
	var extremeType string
	var signal string
	var score float64

	if nearHigh && nearLow {
		// Stock has very narrow range - unusual
		extremeType = "52W High & Low"
		signal = models.SignalNeutral
		score = 50
	} else if nearHigh {
		extremeType = "52W High"
		signal = models.SignalBuy // Breakout potential
		score = (1 - math.Abs(distFromHigh)/threshold) * 100
	} else {
		extremeType = "52W Low"
		signal = models.SignalBuy // Potential support
		score = (1 - distFromLow/threshold) * 100
	}

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        score,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"52w_high":               math.Round(week52High*100) / 100,
			"52w_low":                math.Round(week52Low*100) / 100,
			"distance_from_high_pct": math.Round(distFromHigh*10000) / 100,
			"distance_from_low_pct":  math.Round(distFromLow*10000) / 100,
			"extreme_type":           extremeType,
			"volume_latest":          data.LastVolume(),
			"date_latest":            data.LastDate().Format("2006-01-02"),
		},
	}, nil
}

