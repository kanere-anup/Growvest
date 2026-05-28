package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

type VWAPStrategy struct {
	BaseStrategy
}

func NewVWAPStrategy() *VWAPStrategy {
	return &VWAPStrategy{
		BaseStrategy: BaseStrategy{
			name:        "vwap",
			displayName: "VWAP (Volume Weighted Avg Price)",
			description: "Identifies stocks trading significantly above or below their VWAP. VWAP acts as a dynamic support/resistance level favored by institutional traders.",
			category:    "technical",
		},
	}
}

func (s *VWAPStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"tolerance":  0.02,
		"min_volume": 100000.0,
	}
}

func (s *VWAPStrategy) Validate(params map[string]interface{}) error {
	tolerance := GetFloatParam(params, "tolerance", 0.02)
	if tolerance <= 0 || tolerance > 0.5 {
		return ErrInvalidParams
	}
	return nil
}

func (s *VWAPStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	tolerance := GetFloatParam(params, "tolerance", 0.02)
	minVolume := GetFloatParam(params, "min_volume", 100000)

	if data.Len() < 5 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	currentPrice := data.LastClose()
	if currentPrice <= 0 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	avgVolume := Mean(data.Volume)
	if avgVolume < minVolume {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	var cumTP, cumVol float64
	for i := 0; i < data.Len(); i++ {
		tp := (data.High[i] + data.Low[i] + data.Close[i]) / 3
		vol := data.Volume[i]
		cumTP += tp * vol
		cumVol += vol
	}

	if cumVol == 0 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	vwapValue := cumTP / cumVol
	deviation := (currentPrice - vwapValue) / vwapValue

	if math.Abs(deviation) > tolerance {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	signal := models.SignalBuy
	score := (1 - math.Abs(deviation)/tolerance) * 100

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        math.Round(score*100) / 100,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"vwap":            math.Round(vwapValue*100) / 100,
			"deviation_pct":   math.Round(deviation*10000) / 100,
			"position":        vwapPosition(deviation),
			"avg_volume":      math.Round(avgVolume),
			"volume_latest":   data.LastVolume(),
			"date_latest":     data.LastDate().Format("2006-01-02"),
		},
	}, nil
}

func vwapPosition(deviation float64) string {
	if deviation > 0.005 {
		return "Above VWAP"
	}
	if deviation < -0.005 {
		return "Below VWAP"
	}
	return "At VWAP"
}
