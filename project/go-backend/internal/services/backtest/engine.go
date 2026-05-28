package backtest

import (
	"context"
	"math"
	"time"

	"github.com/growvest/stock-screener/internal/services/strategies"
)

type TradeType string

const (
	TradeEntry TradeType = "entry"
	TradeExit  TradeType = "exit"
)

type Trade struct {
	Date       time.Time              `json:"date"`
	Type       TradeType              `json:"type"`
	Price      float64                `json:"price"`
	Signal     string                 `json:"signal"`
	Score      float64                `json:"score"`
	ResultData map[string]interface{} `json:"result_data,omitempty"`
}

type BacktestResult struct {
	Symbol         string    `json:"symbol"`
	Strategy       string    `json:"strategy"`
	StartDate      time.Time `json:"start_date"`
	EndDate        time.Time `json:"end_date"`
	InitialCapital float64   `json:"initial_capital"`
	FinalCapital   float64   `json:"final_capital"`
	TotalReturn    float64   `json:"total_return"`
	AnnualReturn   float64   `json:"annual_return"`
	MaxDrawdown    float64   `json:"max_drawdown"`
	SharpeRatio    float64   `json:"sharpe_ratio"`
	WinRate        float64   `json:"win_rate"`
	TotalTrades    int       `json:"total_trades"`
	WinningTrades  int       `json:"winning_trades"`
	LosingTrades   int       `json:"losing_trades"`
	AvgWin         float64   `json:"avg_win"`
	AvgLoss        float64   `json:"avg_loss"`
	ProfitFactor   float64   `json:"profit_factor"`
	Trades         []Trade   `json:"trades"`
	EquityCurve    []float64 `json:"equity_curve"`
	Dates          []string  `json:"dates"`
}

type Engine struct {
	registry *strategies.Registry
}

func NewEngine(registry *strategies.Registry) *Engine {
	return &Engine{registry: registry}
}

func (e *Engine) Run(ctx context.Context, data *strategies.StockData, strategyName string, params map[string]interface{}, initialCapital float64) (*BacktestResult, error) {
	strategy, ok := e.registry.Get(strategyName)
	if !ok {
		return nil, strategies.ErrStrategyNotFound
	}

	if data.Len() < 30 {
		return nil, strategies.ErrInsufficientData
	}

	result := &BacktestResult{
		Symbol:         data.Symbol,
		Strategy:       strategyName,
		StartDate:      data.Dates[0],
		EndDate:        data.Dates[data.Len()-1],
		InitialCapital: initialCapital,
	}

	capital := initialCapital
	position := 0.0
	entryPrice := 0.0
	peak := initialCapital
	maxDrawdown := 0.0

	var trades []Trade
	var equityCurve []float64
	var dates []string
	var wins, losses []float64

	// Walk forward through data, running strategy at each step with a lookback window
	minLookback := 30
	for i := minLookback; i < data.Len(); i++ {
		window := &strategies.StockData{
			Symbol:   data.Symbol,
			Exchange: data.Exchange,
			Dates:    data.Dates[:i+1],
			Open:     data.Open[:i+1],
			High:     data.High[:i+1],
			Low:      data.Low[:i+1],
			Close:    data.Close[:i+1],
			Volume:   data.Volume[:i+1],
			AdjClose: data.AdjClose[:i+1],
		}

		res, err := strategy.Execute(ctx, window, params)
		if err != nil {
			continue
		}

		price := data.Close[i]
		portfolioValue := capital
		if position > 0 {
			portfolioValue = capital + position*(price-entryPrice)
		}

		equityCurve = append(equityCurve, portfolioValue)
		dates = append(dates, data.Dates[i].Format("2006-01-02"))

		if portfolioValue > peak {
			peak = portfolioValue
		}
		dd := (peak - portfolioValue) / peak
		if dd > maxDrawdown {
			maxDrawdown = dd
		}

		if res.Matched && res.Signal == "buy" && position == 0 {
			shares := math.Floor(capital / price)
			if shares > 0 {
				position = shares
				entryPrice = price
				capital -= shares * price
				trades = append(trades, Trade{
					Date:       data.Dates[i],
					Type:       TradeEntry,
					Price:      price,
					Signal:     res.Signal,
					Score:      res.Score,
					ResultData: res.ResultData,
				})
			}
		} else if position > 0 && res.Matched && res.Signal == "sell" {
			pnl := position * (price - entryPrice)
			capital += position * price
			trades = append(trades, Trade{
				Date:   data.Dates[i],
				Type:   TradeExit,
				Price:  price,
				Signal: res.Signal,
				Score:  res.Score,
			})
			if pnl > 0 {
				wins = append(wins, pnl)
			} else {
				losses = append(losses, pnl)
			}
			position = 0
			entryPrice = 0
		}
	}

	// Close any open position at end
	if position > 0 {
		lastPrice := data.Close[data.Len()-1]
		pnl := position * (lastPrice - entryPrice)
		capital += position * lastPrice
		trades = append(trades, Trade{
			Date:   data.Dates[data.Len()-1],
			Type:   TradeExit,
			Price:  lastPrice,
			Signal: "close",
		})
		if pnl > 0 {
			wins = append(wins, pnl)
		} else {
			losses = append(losses, pnl)
		}
	}

	result.FinalCapital = capital
	result.TotalReturn = (capital - initialCapital) / initialCapital * 100
	result.MaxDrawdown = maxDrawdown * 100
	result.TotalTrades = len(wins) + len(losses)
	result.WinningTrades = len(wins)
	result.LosingTrades = len(losses)
	result.Trades = trades
	result.EquityCurve = equityCurve
	result.Dates = dates

	if result.TotalTrades > 0 {
		result.WinRate = float64(result.WinningTrades) / float64(result.TotalTrades) * 100
	}
	if len(wins) > 0 {
		result.AvgWin = sum(wins) / float64(len(wins))
	}
	if len(losses) > 0 {
		result.AvgLoss = math.Abs(sum(losses) / float64(len(losses)))
	}
	if result.AvgLoss > 0 {
		result.ProfitFactor = result.AvgWin / result.AvgLoss
	}

	years := data.Dates[data.Len()-1].Sub(data.Dates[0]).Hours() / (24 * 365.25)
	if years > 0 {
		result.AnnualReturn = (math.Pow(capital/initialCapital, 1.0/years) - 1) * 100
	}

	// Simplified Sharpe ratio from daily returns
	if len(equityCurve) > 1 {
		var dailyReturns []float64
		for i := 1; i < len(equityCurve); i++ {
			dailyReturns = append(dailyReturns, (equityCurve[i]-equityCurve[i-1])/equityCurve[i-1])
		}
		avgReturn := sum(dailyReturns) / float64(len(dailyReturns))
		stdDev := stddev(dailyReturns, avgReturn)
		if stdDev > 0 {
			result.SharpeRatio = (avgReturn / stdDev) * math.Sqrt(252)
		}
	}

	return result, nil
}

func sum(vals []float64) float64 {
	s := 0.0
	for _, v := range vals {
		s += v
	}
	return s
}

func stddev(vals []float64, mean float64) float64 {
	if len(vals) < 2 {
		return 0
	}
	sumSq := 0.0
	for _, v := range vals {
		d := v - mean
		sumSq += d * d
	}
	return math.Sqrt(sumSq / float64(len(vals)-1))
}
