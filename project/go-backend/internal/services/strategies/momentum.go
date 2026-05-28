package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

// MomentumStrategy identifies stocks with strong recent price performance
type MomentumStrategy struct {
	BaseStrategy
}

// NewMomentumStrategy creates a new Momentum strategy
func NewMomentumStrategy() *MomentumStrategy {
	return &MomentumStrategy{
		BaseStrategy: BaseStrategy{
			name:        "momentum",
			displayName: "Momentum Stocks",
			description: "Identifies stocks with strong recent performance across multiple timeframes. Momentum investing is based on the idea that trends tend to persist.",
			category:    "technical",
		},
	}
}

// DefaultParams returns the default parameters for this strategy
func (s *MomentumStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"threshold_5d":  3.0,  // 3% gain in 5 days
		"threshold_10d": 5.0,  // 5% gain in 10 days
		"threshold_20d": 10.0, // 10% gain in 20 days
	}
}

// Validate checks if the parameters are valid
func (s *MomentumStrategy) Validate(params map[string]interface{}) error {
	threshold5d := GetFloatParam(params, "threshold_5d", 3.0)
	threshold10d := GetFloatParam(params, "threshold_10d", 5.0)
	threshold20d := GetFloatParam(params, "threshold_20d", 10.0)

	if threshold5d < 0 || threshold10d < 0 || threshold20d < 0 {
		return ErrInvalidParams
	}

	return nil
}

// Execute runs the Momentum strategy
func (s *MomentumStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	// Check for cancellation
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// Get current price
	currentPrice := data.LastClose()
	if currentPrice <= 0 {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Handle case with limited data (only current quote)
	if data.Len() < 50 {
		// With limited data, use price change from previous close
		var priceChange float64
		var signal string

		if len(data.Close) >= 2 {
			prevClose := data.Close[0] // First element is previous close in limited data
			if prevClose > 0 {
				priceChange = (currentPrice - prevClose) / prevClose * 100
			}
		}

		// Check for momentum based on daily change
		if priceChange >= 2.0 { // Strong bullish momentum
			signal = models.SignalBuy
		} else if priceChange <= -2.0 { // Strong bearish momentum
			signal = models.SignalSell
		} else {
			signal = models.SignalNeutral
		}

		// Score based on absolute change magnitude
		score := math.Min(math.Abs(priceChange)*10, 75) // Max 75 without full data

		return &StrategyResult{
			Symbol:       data.Symbol,
			CurrentPrice: currentPrice,
			Score:        score,
			Signal:       signal,
			Matched:      signal != models.SignalNeutral,
			ResultData: map[string]interface{}{
				"daily_change_pct": math.Round(priceChange*100) / 100,
				"momentum_type":    getMomentumType(priceChange),
				"note":             "Limited data analysis (daily momentum only)",
				"volume_latest":    data.LastVolume(),
				"date_latest":      data.LastDate().Format("2006-01-02"),
			},
		}, nil
	}

	// Full historical data analysis
	threshold5d := GetFloatParam(params, "threshold_5d", 3.0)
	threshold10d := GetFloatParam(params, "threshold_10d", 5.0)
	threshold20d := GetFloatParam(params, "threshold_20d", 10.0)

	// Calculate returns for different periods
	price5dAgo := data.Close[len(data.Close)-6]
	price10dAgo := data.Close[len(data.Close)-11]
	price20dAgo := data.Close[len(data.Close)-21]

	return5d := (currentPrice - price5dAgo) / price5dAgo * 100
	return10d := (currentPrice - price10dAgo) / price10dAgo * 100
	return20d := (currentPrice - price20dAgo) / price20dAgo * 100

	// Check momentum criteria
	meets5d := return5d >= threshold5d
	meets10d := return10d >= threshold10d
	meets20d := return20d >= threshold20d

	// All criteria must be met
	if !meets5d || !meets10d || !meets20d {
		return &StrategyResult{
			Symbol:  data.Symbol,
			Matched: false,
		}, nil
	}

	// Calculate momentum score (average of normalized returns)
	normalizedReturn5d := return5d / threshold5d
	normalizedReturn10d := return10d / threshold10d
	normalizedReturn20d := return20d / threshold20d
	momentumScore := (normalizedReturn5d + normalizedReturn10d + normalizedReturn20d) / 3 * 100

	// Cap score at 100
	score := math.Min(momentumScore, 100)

	// Calculate additional metrics
	price50dAgo := data.Close[len(data.Close)-50]
	return50d := (currentPrice - price50dAgo) / price50dAgo * 100

	// RSI-like momentum indicator (simplified)
	gains := 0.0
	losses := 0.0
	for i := len(data.Close) - 14; i < len(data.Close); i++ {
		change := data.Close[i] - data.Close[i-1]
		if change > 0 {
			gains += change
		} else {
			losses -= change
		}
	}
	var rsi float64
	if losses == 0 {
		rsi = 100
	} else {
		rs := gains / losses
		rsi = 100 - (100 / (1 + rs))
	}

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        score,
		Signal:       models.SignalBuy,
		Matched:      true,
		ResultData: map[string]interface{}{
			"return_5d_pct":  math.Round(return5d*100) / 100,
			"return_10d_pct": math.Round(return10d*100) / 100,
			"return_20d_pct": math.Round(return20d*100) / 100,
			"return_50d_pct": math.Round(return50d*100) / 100,
			"momentum_score": math.Round(momentumScore*100) / 100,
			"rsi_14":         math.Round(rsi*100) / 100,
			"volume_latest":  data.LastVolume(),
			"date_latest":    data.LastDate().Format("2006-01-02"),
		},
	}, nil
}

func getMomentumType(priceChange float64) string {
	if priceChange >= 5.0 {
		return "Strong Bullish"
	} else if priceChange >= 2.0 {
		return "Bullish"
	} else if priceChange <= -5.0 {
		return "Strong Bearish"
	} else if priceChange <= -2.0 {
		return "Bearish"
	}
	return "Neutral"
}
