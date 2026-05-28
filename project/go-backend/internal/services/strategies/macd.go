package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

type MACDStrategy struct {
	BaseStrategy
}

func NewMACDStrategy() *MACDStrategy {
	return &MACDStrategy{
		BaseStrategy: BaseStrategy{
			name:        "macd",
			displayName: "MACD Crossover",
			description: "Detects Moving Average Convergence Divergence crossover signals. A bullish crossover occurs when MACD crosses above the signal line; bearish when it crosses below.",
			category:    "technical",
		},
	}
}

func (s *MACDStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"fast_period":   12,
		"slow_period":   26,
		"signal_period": 9,
	}
}

func (s *MACDStrategy) Validate(params map[string]interface{}) error {
	fast := GetIntParam(params, "fast_period", 12)
	slow := GetIntParam(params, "slow_period", 26)
	signal := GetIntParam(params, "signal_period", 9)
	if fast < 2 || slow < 2 || signal < 2 || fast >= slow {
		return ErrInvalidParams
	}
	return nil
}

func (s *MACDStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	fastPeriod := GetIntParam(params, "fast_period", 12)
	slowPeriod := GetIntParam(params, "slow_period", 26)
	signalPeriod := GetIntParam(params, "signal_period", 9)

	minRequired := slowPeriod + signalPeriod + 1
	if data.Len() < minRequired {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	closes := data.Close
	fastEMA := calculateEMA(closes, fastPeriod)
	slowEMA := calculateEMA(closes, slowPeriod)

	macdLine := make([]float64, len(slowEMA))
	offset := len(fastEMA) - len(slowEMA)
	for i := range slowEMA {
		macdLine[i] = fastEMA[i+offset] - slowEMA[i]
	}

	signalLine := calculateEMA(macdLine, signalPeriod)

	if len(signalLine) < 2 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	macdOffset := len(macdLine) - len(signalLine)
	currentMACD := macdLine[macdOffset+len(signalLine)-1]
	currentSignal := signalLine[len(signalLine)-1]
	prevMACD := macdLine[macdOffset+len(signalLine)-2]
	prevSignal := signalLine[len(signalLine)-2]

	histogram := currentMACD - currentSignal
	currentPrice := data.LastClose()

	bullishCross := prevMACD <= prevSignal && currentMACD > currentSignal
	bearishCross := prevMACD >= prevSignal && currentMACD < currentSignal

	if !bullishCross && !bearishCross {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	var signal string
	var crossType string
	if bullishCross {
		signal = models.SignalBuy
		crossType = "Bullish Crossover"
	} else {
		signal = models.SignalSell
		crossType = "Bearish Crossover"
	}

	score := math.Min(math.Abs(histogram)*1000, 100)

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        math.Round(score*100) / 100,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"macd":           math.Round(currentMACD*10000) / 10000,
			"signal_line":    math.Round(currentSignal*10000) / 10000,
			"histogram":      math.Round(histogram*10000) / 10000,
			"cross_type":     crossType,
			"fast_period":    fastPeriod,
			"slow_period":    slowPeriod,
			"signal_period":  signalPeriod,
			"volume_latest":  data.LastVolume(),
			"date_latest":    data.LastDate().Format("2006-01-02"),
		},
	}, nil
}

func calculateEMA(data []float64, period int) []float64 {
	if len(data) < period {
		return nil
	}

	multiplier := 2.0 / float64(period+1)
	ema := make([]float64, len(data)-period+1)

	sma := 0.0
	for i := 0; i < period; i++ {
		sma += data[i]
	}
	ema[0] = sma / float64(period)

	for i := 1; i < len(ema); i++ {
		ema[i] = (data[i+period-1]-ema[i-1])*multiplier + ema[i-1]
	}

	return ema
}
