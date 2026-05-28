package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

// VolumeBreakoutStrategy identifies stocks with significant volume spikes
type VolumeBreakoutStrategy struct {
	BaseStrategy
}

// NewVolumeBreakoutStrategy creates a new Volume Breakout strategy
func NewVolumeBreakoutStrategy() *VolumeBreakoutStrategy {
	return &VolumeBreakoutStrategy{
		BaseStrategy: BaseStrategy{
			name:        "volume_breakout",
			displayName: "Volume Breakout",
			description: "Detects stocks with volume significantly above their average. High volume often precedes or confirms price breakouts.",
			category:    "technical",
		},
	}
}

// DefaultParams returns the default parameters for this strategy
func (s *VolumeBreakoutStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"multiplier": 2.0,      // Volume must be 2x average
		"avg_period": 20,       // 20-day average
		"min_volume": 100000.0, // Minimum volume
	}
}

// Validate checks if the parameters are valid
func (s *VolumeBreakoutStrategy) Validate(params map[string]interface{}) error {
	multiplier := GetFloatParam(params, "multiplier", 2.0)
	if multiplier < 1.0 || multiplier > 10.0 {
		return ErrInvalidParams
	}

	avgPeriod := GetIntParam(params, "avg_period", 20)
	if avgPeriod < 5 || avgPeriod > 100 {
		return ErrInvalidParams
	}

	return nil
}

// Execute runs the Volume Breakout strategy
func (s *VolumeBreakoutStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	// Check for cancellation
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// Get parameters
	multiplier := GetFloatParam(params, "multiplier", 2.0)
	avgPeriod := GetIntParam(params, "avg_period", 20)
	minVolume := GetFloatParam(params, "min_volume", 100000)

	// Get current values
	currentVolume := data.LastVolume()
	currentPrice := data.LastClose()

	// Handle case with limited data (only current quote)
	if data.Len() < avgPeriod+1 {
		// With limited data, check if current volume meets minimum
		if currentVolume < minVolume || currentPrice <= 0 {
			return &StrategyResult{
				Symbol:  data.Symbol,
				Matched: false,
			}, nil
		}

		// Get price change from previous close if available
		var priceChange float64
		var breakoutType string
		var signal string

		if len(data.Close) >= 2 {
			prevClose := data.Close[len(data.Close)-2]
			if prevClose > 0 {
				priceChange = (currentPrice - prevClose) / prevClose * 100
			}
		}

		if priceChange > 1.0 { // More than 1% up
			breakoutType = "Bullish"
			signal = models.SignalBuy
		} else if priceChange < -1.0 { // More than 1% down
			breakoutType = "Bearish"
			signal = models.SignalSell
		} else {
			breakoutType = "Neutral"
			signal = models.SignalNeutral
		}

		// Without historical average, use volume-based score
		score := math.Min(currentVolume/minVolume*25, 75) // Max 75 score without full data

		return &StrategyResult{
			Symbol:       data.Symbol,
			CurrentPrice: currentPrice,
			Score:        score,
			Signal:       signal,
			Matched:      signal != models.SignalNeutral,
			ResultData: map[string]interface{}{
				"current_volume":   currentVolume,
				"avg_volume":       "N/A (insufficient data)",
				"price_change_pct": math.Round(priceChange*100) / 100,
				"breakout_type":    breakoutType,
				"note":             "Limited data analysis",
				"date_latest":      data.LastDate().Format("2006-01-02"),
			},
		}, nil
	}

	// Full historical data analysis
	volumeData := data.Volume[:len(data.Volume)-1]
	if len(volumeData) > avgPeriod {
		volumeData = volumeData[len(volumeData)-avgPeriod:]
	}
	avgVolume := Mean(volumeData)

	// Check minimum volume
	if avgVolume < minVolume {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Calculate volume ratio
	volumeRatio := currentVolume / avgVolume

	// Check if breakout condition is met
	if volumeRatio < multiplier {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Calculate price change
	prevClose := data.Close[len(data.Close)-2]
	priceChange := (currentPrice - prevClose) / prevClose * 100

	// Determine breakout type and signal
	var breakoutType string
	var signal string
	if priceChange > 0 {
		breakoutType = "Bullish"
		signal = models.SignalBuy
	} else if priceChange < 0 {
		breakoutType = "Bearish"
		signal = models.SignalSell
	} else {
		breakoutType = "Neutral"
		signal = models.SignalNeutral
	}

	// Calculate score (higher volume ratio = higher score)
	score := math.Min(volumeRatio/multiplier*50, 100)

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        score,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"current_volume":   currentVolume,
			"avg_volume":       math.Round(avgVolume),
			"volume_ratio":     math.Round(volumeRatio*100) / 100,
			"price_change_pct": math.Round(priceChange*100) / 100,
			"breakout_type":    breakoutType,
			"avg_period":       avgPeriod,
			"date_latest":      data.LastDate().Format("2006-01-02"),
		},
	}, nil
}
