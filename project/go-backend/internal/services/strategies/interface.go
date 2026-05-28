package strategies

import (
	"context"
	"errors"
	"time"
)

var (
	ErrInvalidParams    = errors.New("invalid strategy parameters")
	ErrInsufficientData = errors.New("insufficient data for analysis")
	ErrStrategyNotFound = errors.New("strategy not registered")
	ErrExecutionFailed  = errors.New("strategy execution failed")
)

// StockData represents historical stock data for analysis
type StockData struct {
	Symbol   string
	Exchange string
	Dates    []time.Time
	Open     []float64
	High     []float64
	Low      []float64
	Close    []float64
	Volume   []float64
	AdjClose []float64
}

// StrategyResult contains the result of a strategy execution
type StrategyResult struct {
	Symbol       string                 `json:"symbol"`
	CurrentPrice float64                `json:"current_price"`
	Score        float64                `json:"score"`
	Signal       string                 `json:"signal"` // buy, sell, hold, neutral
	ResultData   map[string]interface{} `json:"result_data"`
	Matched      bool                   `json:"matched"`
}

// StrategyInfo contains metadata about a strategy
type StrategyInfo struct {
	Name          string                 `json:"name"`
	DisplayName   string                 `json:"display_name"`
	Description   string                 `json:"description"`
	Category      string                 `json:"category"`
	DefaultParams map[string]interface{} `json:"default_params"`
}

// Strategy interface defines the contract for all strategies
type Strategy interface {
	// Name returns the internal strategy name
	Name() string

	// Info returns strategy metadata
	Info() StrategyInfo

	// Execute runs the strategy on the given stock data
	Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error)

	// Validate checks if the parameters are valid
	Validate(params map[string]interface{}) error

	// DefaultParams returns the default parameters
	DefaultParams() map[string]interface{}
}

// HistoricalDataNeeder is an optional interface that strategies can implement
// to indicate they need historical data fetched from a specific date.
// The scanner executor will check for this interface and fetch historical data accordingly.
type HistoricalDataNeeder interface {
	// NeedsHistoricalData returns true if this strategy requires historical data,
	// along with the start date from which data should be fetched.
	NeedsHistoricalData(params map[string]interface{}) (needsData bool, fromDate time.Time)
}

// BaseStrategy provides common functionality for strategies
type BaseStrategy struct {
	name        string
	displayName string
	description string
	category    string
}

// Name returns the strategy name
func (s *BaseStrategy) Name() string {
	return s.name
}

// Info returns strategy metadata
func (s *BaseStrategy) Info() StrategyInfo {
	return StrategyInfo{
		Name:          s.name,
		DisplayName:   s.displayName,
		Description:   s.description,
		Category:      s.category,
		DefaultParams: s.DefaultParams(),
	}
}

// DefaultParams returns empty default params (override in implementations)
func (s *BaseStrategy) DefaultParams() map[string]interface{} {
	return make(map[string]interface{})
}

// Helper functions for StockData

// Len returns the number of data points
func (d *StockData) Len() int {
	return len(d.Close)
}

// LastClose returns the most recent closing price
func (d *StockData) LastClose() float64 {
	if len(d.Close) == 0 {
		return 0
	}
	return d.Close[len(d.Close)-1]
}

// LastVolume returns the most recent volume
func (d *StockData) LastVolume() float64 {
	if len(d.Volume) == 0 {
		return 0
	}
	return d.Volume[len(d.Volume)-1]
}

// LastDate returns the most recent date
func (d *StockData) LastDate() time.Time {
	if len(d.Dates) == 0 {
		return time.Time{}
	}
	return d.Dates[len(d.Dates)-1]
}

// Tail returns the last n data points
func (d *StockData) Tail(n int) *StockData {
	if n >= d.Len() {
		return d
	}
	start := d.Len() - n
	return &StockData{
		Symbol:   d.Symbol,
		Exchange: d.Exchange,
		Dates:    d.Dates[start:],
		Open:     d.Open[start:],
		High:     d.High[start:],
		Low:      d.Low[start:],
		Close:    d.Close[start:],
		Volume:   d.Volume[start:],
		AdjClose: d.AdjClose[start:],
	}
}

// FilterFromDate returns data from the given date onwards
func (d *StockData) FilterFromDate(from time.Time) *StockData {
	startIdx := 0
	for i, date := range d.Dates {
		if !date.Before(from) {
			startIdx = i
			break
		}
	}
	return &StockData{
		Symbol:   d.Symbol,
		Exchange: d.Exchange,
		Dates:    d.Dates[startIdx:],
		Open:     d.Open[startIdx:],
		High:     d.High[startIdx:],
		Low:      d.Low[startIdx:],
		Close:    d.Close[startIdx:],
		Volume:   d.Volume[startIdx:],
		AdjClose: d.AdjClose[startIdx:],
	}
}

// Helper functions for calculations

// Max returns the maximum value in a slice
func Max(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	max := values[0]
	for _, v := range values[1:] {
		if v > max {
			max = v
		}
	}
	return max
}

// Min returns the minimum value in a slice
func Min(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	min := values[0]
	for _, v := range values[1:] {
		if v < min {
			min = v
		}
	}
	return min
}

// Sum returns the sum of values
func Sum(values []float64) float64 {
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum
}

// Mean returns the average of values
func Mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	return Sum(values) / float64(len(values))
}

// GetFloatParam extracts a float parameter with default value
func GetFloatParam(params map[string]interface{}, key string, defaultVal float64) float64 {
	if val, ok := params[key]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case float32:
			return float64(v)
		case int:
			return float64(v)
		case int64:
			return float64(v)
		}
	}
	return defaultVal
}

// GetIntParam extracts an integer parameter with default value
func GetIntParam(params map[string]interface{}, key string, defaultVal int) int {
	if val, ok := params[key]; ok {
		switch v := val.(type) {
		case int:
			return v
		case int64:
			return int(v)
		case float64:
			return int(v)
		case float32:
			return int(v)
		}
	}
	return defaultVal
}

// GetStringParam extracts a string parameter with default value
func GetStringParam(params map[string]interface{}, key string, defaultVal string) string {
	if val, ok := params[key]; ok {
		if s, ok := val.(string); ok {
			return s
		}
	}
	return defaultVal
}
