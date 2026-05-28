package strategies

import (
	"context"
	"math"

	"github.com/growvest/stock-screener/internal/models"
)

type RSIStrategy struct {
	BaseStrategy
}

func NewRSIStrategy() *RSIStrategy {
	return &RSIStrategy{
		BaseStrategy: BaseStrategy{
			name:        "rsi",
			displayName: "RSI (Relative Strength Index)",
			description: "Identifies overbought (RSI > 70) and oversold (RSI < 30) conditions using the 14-period RSI. Oversold stocks may bounce, overbought may pull back.",
			category:    "technical",
		},
	}
}

func (s *RSIStrategy) DefaultParams() map[string]interface{} {
	return map[string]interface{}{
		"period":             14,
		"overbought":         70.0,
		"oversold":           30.0,
		"signal_on_oversold": true,
	}
}

func (s *RSIStrategy) Validate(params map[string]interface{}) error {
	period := GetIntParam(params, "period", 14)
	if period < 2 || period > 100 {
		return ErrInvalidParams
	}
	overbought := GetFloatParam(params, "overbought", 70)
	oversold := GetFloatParam(params, "oversold", 30)
	if oversold >= overbought || oversold < 0 || overbought > 100 {
		return ErrInvalidParams
	}
	return nil
}

func (s *RSIStrategy) Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	period := GetIntParam(params, "period", 14)
	overbought := GetFloatParam(params, "overbought", 70)
	oversold := GetFloatParam(params, "oversold", 30)

	if data.Len() < period+1 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	rsi := calculateRSI(data.Close, period)
	currentPrice := data.LastClose()

	if rsi < 0 || currentPrice <= 0 {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	var signal string
	var score float64
	matched := false

	if rsi <= oversold {
		signal = models.SignalBuy
		score = (1 - rsi/oversold) * 100
		matched = true
	} else if rsi >= overbought {
		signal = models.SignalSell
		score = ((rsi - overbought) / (100 - overbought)) * 100
		matched = true
	}

	if !matched {
		return &StrategyResult{Symbol: data.Symbol, Matched: false}, nil
	}

	return &StrategyResult{
		Symbol:       data.Symbol,
		CurrentPrice: currentPrice,
		Score:        math.Round(score*100) / 100,
		Signal:       signal,
		Matched:      true,
		ResultData: map[string]interface{}{
			"rsi":           math.Round(rsi*100) / 100,
			"period":        period,
			"condition":     conditionName(rsi, overbought, oversold),
			"volume_latest": data.LastVolume(),
			"date_latest":   data.LastDate().Format("2006-01-02"),
		},
	}, nil
}

func calculateRSI(closes []float64, period int) float64 {
	if len(closes) < period+1 {
		return -1
	}

	var avgGain, avgLoss float64
	for i := 1; i <= period; i++ {
		change := closes[len(closes)-period-1+i] - closes[len(closes)-period-1+i-1]
		if change > 0 {
			avgGain += change
		} else {
			avgLoss -= change
		}
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	if avgLoss == 0 {
		return 100
	}
	rs := avgGain / avgLoss
	return 100 - (100 / (1 + rs))
}

func conditionName(rsi, overbought, oversold float64) string {
	if rsi <= oversold {
		return "Oversold"
	}
	if rsi >= overbought {
		return "Overbought"
	}
	return "Neutral"
}
