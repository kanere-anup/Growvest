package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

type MeanReversionStrategy struct {
	BaseStrategy
}

func NewMeanReversionStrategy() *MeanReversionStrategy {
	return &MeanReversionStrategy{
		BaseStrategy: BaseStrategy{
			name:        "mean_reversion",
			displayName: "Mean Reversion",
			description: "Identifies stocks that have deviated significantly from their moving average and may revert. Uses z-score to measure standard deviations from the mean.",
			category:    "technical",
		},
	}
}

func (s *MeanReversionStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"period":        20,
		"z_score_threshold": 2.0,
	}
}

func (s *MeanReversionStrategy) Validate(params map[string]interface{}) error {
	period := GetIntParam(params, "period", 20)
	zThreshold := GetFloatParam(params, "z_score_threshold", 2.0)
	if period < 5 || period > 200 || zThreshold < 0.5 || zThreshold > 5.0 {
		return ErrInvalidParams
	}
	return nil
}

func (s *MeanReversionStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	period := GetIntParam(params, "period", 20)
	zThreshold := GetFloatParam(params, "z_score_threshold", 2.0)

	if data.Len() < period {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	closes := data.Close
	window := closes[len(closes)-period:]
	currentPrice := data.LastClose()

	if currentPrice <= 0 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	mean := Mean(window)
	stdDev := standardDeviation(window, mean)

	if stdDev == 0 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	zScore := (currentPrice - mean) / stdDev

	if math.Abs(zScore) < zThreshold {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	var signal, condition string
	if zScore < -zThreshold {
		signal = models.SignalBuy
		condition = "Below Mean (expect reversion up)"
	} else {
		signal = models.SignalSell
		condition = "Above Mean (expect reversion down)"
	}

	score := math.Min(math.Abs(zScore)/zThreshold*50, 100)
	deviationPct := (currentPrice - mean) / mean * 100

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        math.Round(score*100) / 100,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"z_score":          math.Round(zScore*100) / 100,
			"mean_price":       math.Round(mean*100) / 100,
			"std_deviation":    math.Round(stdDev*100) / 100,
			"deviation_pct":    math.Round(deviationPct*100) / 100,
			"condition":        condition,
			"period":           period,
			"volume_latest":    data.LastVolume(),
			"date_latest":      data.LastDate().Format("2006-01-02"),
		},
	}, nil
}
