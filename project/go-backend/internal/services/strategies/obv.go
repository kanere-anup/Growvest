package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

type OBVStrategy struct {
	BaseStrategy
}

func NewOBVStrategy() *OBVStrategy {
	return &OBVStrategy{
		BaseStrategy: BaseStrategy{
			name:        "obv",
			displayName: "OBV (On Balance Volume)",
			description: "Detects OBV divergence from price. Rising OBV with flat/falling price suggests accumulation (bullish); falling OBV with rising price suggests distribution (bearish).",
			category:    "technical",
		},
	}
}

func (s *OBVStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"lookback_days":     20,
		"divergence_threshold": 5.0, // percent
	}
}

func (s *OBVStrategy) Validate(params map[string]interface{}) error {
	lookback := GetIntParam(params, "lookback_days", 20)
	if lookback < 5 || lookback > 200 {
		return ErrInvalidParams
	}
	return nil
}

func (s *OBVStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	lookback := GetIntParam(params, "lookback_days", 20)
	threshold := GetFloatParam(params, "divergence_threshold", 5.0)

	if data.Len() < lookback+1 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	obv := make([]float64, data.Len())
	obv[0] = data.Volume[0]
	for i := 1; i < data.Len(); i++ {
		if data.Close[i] > data.Close[i-1] {
			obv[i] = obv[i-1] + data.Volume[i]
		} else if data.Close[i] < data.Close[i-1] {
			obv[i] = obv[i-1] - data.Volume[i]
		} else {
			obv[i] = obv[i-1]
		}
	}

	startIdx := data.Len() - lookback - 1
	endIdx := data.Len() - 1

	priceStart := data.Close[startIdx]
	priceEnd := data.Close[endIdx]
	obvStart := obv[startIdx]
	obvEnd := obv[endIdx]

	if priceStart == 0 || obvStart == 0 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	priceChange := (priceEnd - priceStart) / priceStart * 100
	obvChange := (obvEnd - obvStart) / math.Abs(obvStart) * 100

	divergence := obvChange - priceChange

	if math.Abs(divergence) < threshold {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	var signal, divergenceType string
	if divergence > 0 {
		signal = models.SignalBuy
		divergenceType = "Bullish Divergence (accumulation)"
	} else {
		signal = models.SignalSell
		divergenceType = "Bearish Divergence (distribution)"
	}

	score := math.Min(math.Abs(divergence)/threshold*50, 100)
	currentPrice := data.LastClose()

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        math.Round(score*100) / 100,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"obv_current":      math.Round(obvEnd),
			"obv_change_pct":   math.Round(obvChange*100) / 100,
			"price_change_pct": math.Round(priceChange*100) / 100,
			"divergence_pct":   math.Round(divergence*100) / 100,
			"divergence_type":  divergenceType,
			"lookback_days":    lookback,
			"volume_latest":    data.LastVolume(),
			"date_latest":      data.LastDate().Format("2006-01-02"),
		},
	}, nil
}
