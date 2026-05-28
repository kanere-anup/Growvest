package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

type EMACrossoverStrategy struct {
	BaseStrategy
}

func NewEMACrossoverStrategy() *EMACrossoverStrategy {
	return &EMACrossoverStrategy{
		BaseStrategy: BaseStrategy{
			name:        "ema_crossover",
			displayName: "EMA/SMA Crossover",
			description: "Detects golden cross (short EMA crosses above long SMA) and death cross (short EMA crosses below long SMA) signals. Classic trend-following indicator.",
			category:    "technical",
		},
	}
}

func (s *EMACrossoverStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"short_period": 9,
		"long_period":  21,
	}
}

func (s *EMACrossoverStrategy) Validate(params map[string]interface{}) error {
	short := GetIntParam(params, "short_period", 9)
	long := GetIntParam(params, "long_period", 21)
	if short < 2 || long < 2 || short >= long {
		return ErrInvalidParams
	}
	return nil
}

func (s *EMACrossoverStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	shortPeriod := GetIntParam(params, "short_period", 9)
	longPeriod := GetIntParam(params, "long_period", 21)

	if data.Len() < longPeriod+2 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	closes := data.Close
	shortEMA := calculateEMA(closes, shortPeriod)
	longSMA := calculateSMA(closes, longPeriod)

	if len(shortEMA) < 2 || len(longSMA) < 2 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	shortOffset := len(shortEMA) - 2
	longOffset := len(longSMA) - 2

	currentShort := shortEMA[shortOffset+1]
	prevShort := shortEMA[shortOffset]
	currentLong := longSMA[longOffset+1]
	prevLong := longSMA[longOffset]

	goldenCross := prevShort <= prevLong && currentShort > currentLong
	deathCross := prevShort >= prevLong && currentShort < currentLong

	if !goldenCross && !deathCross {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	currentPrice := data.LastClose()
	var signal, crossType string
	if goldenCross {
		signal = models.SignalBuy
		crossType = "Golden Cross"
	} else {
		signal = models.SignalSell
		crossType = "Death Cross"
	}

	separation := math.Abs(currentShort-currentLong) / currentLong * 100
	score := math.Min(separation*20, 100)

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        math.Round(score*100) / 100,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"short_ema":      math.Round(currentShort*100) / 100,
			"long_sma":       math.Round(currentLong*100) / 100,
			"cross_type":     crossType,
			"separation_pct": math.Round(separation*100) / 100,
			"short_period":   shortPeriod,
			"long_period":    longPeriod,
			"volume_latest":  data.LastVolume(),
			"date_latest":    data.LastDate().Format("2006-01-02"),
		},
	}, nil
}

func calculateSMA(data []float64, period int) []float64 {
	if len(data) < period {
		return nil
	}
	result := make([]float64, len(data)-period+1)
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += data[i]
	}
	result[0] = sum / float64(period)
	for i := 1; i < len(result); i++ {
		sum += data[i+period-1] - data[i-1]
		result[i] = sum / float64(period)
	}
	return result
}
