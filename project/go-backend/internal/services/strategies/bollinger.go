package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

type BollingerBandsStrategy struct {
	BaseStrategy
}

func NewBollingerBandsStrategy() *BollingerBandsStrategy {
	return &BollingerBandsStrategy{
		BaseStrategy: BaseStrategy{
			name:        "bollinger_bands",
			displayName: "Bollinger Bands",
			description: "Identifies stocks trading near or beyond their Bollinger Bands (2 standard deviations from 20-day SMA). Prices touching the lower band may indicate oversold; upper band may indicate overbought.",
			category:    "technical",
		},
	}
}

func (s *BollingerBandsStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"period":     20,
		"std_dev":    2.0,
		"band_touch": 0.02, // within 2% of band
	}
}

func (s *BollingerBandsStrategy) Validate(params map[string]interface{}) error {
	period := GetIntParam(params, "period", 20)
	stdDev := GetFloatParam(params, "std_dev", 2.0)
	if period < 5 || period > 200 || stdDev < 0.5 || stdDev > 5.0 {
		return ErrInvalidParams
	}
	return nil
}

func (s *BollingerBandsStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	period := GetIntParam(params, "period", 20)
	stdDevMult := GetFloatParam(params, "std_dev", 2.0)
	bandTouch := GetFloatParam(params, "band_touch", 0.02)

	if data.Len() < period {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	closes := data.Close
	window := closes[len(closes)-period:]

	sma := Mean(window)
	stdDev := standardDeviation(window, sma)

	upperBand := sma + stdDevMult*stdDev
	lowerBand := sma - stdDevMult*stdDev
	bandwidth := (upperBand - lowerBand) / sma * 100

	currentPrice := data.LastClose()
	if currentPrice <= 0 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	pctB := (currentPrice - lowerBand) / (upperBand - lowerBand)

	nearLower := (currentPrice-lowerBand)/lowerBand <= bandTouch
	nearUpper := (upperBand-currentPrice)/upperBand <= bandTouch
	belowLower := currentPrice < lowerBand
	aboveUpper := currentPrice > upperBand

	if !nearLower && !nearUpper && !belowLower && !aboveUpper {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	var signal string
	var bandPosition string
	var score float64

	if belowLower || nearLower {
		signal = models.SignalBuy
		bandPosition = "Near/Below Lower Band"
		score = (1 - pctB) * 100
		if score < 0 {
			score = math.Abs(pctB) * 100
		}
	} else {
		signal = models.SignalSell
		bandPosition = "Near/Above Upper Band"
		score = pctB * 100
	}

	score = math.Min(math.Max(score, 0), 100)

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        math.Round(score*100) / 100,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"sma":            math.Round(sma*100) / 100,
			"upper_band":     math.Round(upperBand*100) / 100,
			"lower_band":     math.Round(lowerBand*100) / 100,
			"bandwidth_pct":  math.Round(bandwidth*100) / 100,
			"percent_b":      math.Round(pctB*10000) / 10000,
			"band_position":  bandPosition,
			"std_deviation":  math.Round(stdDev*100) / 100,
			"volume_latest":  data.LastVolume(),
			"date_latest":    data.LastDate().Format("2006-01-02"),
		},
	}, nil
}

func standardDeviation(values []float64, mean float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sumSquares float64
	for _, v := range values {
		diff := v - mean
		sumSquares += diff * diff
	}
	return math.Sqrt(sumSquares / float64(len(values)))
}
