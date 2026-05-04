package strategies

import (
	"sync"
)

// Registry holds all registered strategies
type Registry struct {
	mu         sync.RWMutex
	strategies map[string]Strategy
}

// NewRegistry creates a new strategy registry
func NewRegistry() *Registry {
	return &Registry{
		strategies: make(map[string]Strategy),
	}
}

// Register adds a strategy to the registry
func (r *Registry) Register(strategy Strategy) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.strategies[strategy.Name()] = strategy
}

// Get retrieves a strategy by name
func (r *Registry) Get(name string) (Strategy, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	strategy, ok := r.strategies[name]
	return strategy, ok
}

// List returns all registered strategies
func (r *Registry) List() []StrategyInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	infos := make([]StrategyInfo, 0, len(r.strategies))
	for _, s := range r.strategies {
		infos = append(infos, s.Info())
	}
	return infos
}

// Names returns all registered strategy names
func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.strategies))
	for name := range r.strategies {
		names = append(names, name)
	}
	return names
}

// Count returns the number of registered strategies
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.strategies)
}

// DefaultRegistry is the global strategy registry
var DefaultRegistry = NewRegistry()

// RegisterDefault registers a strategy in the default registry
func RegisterDefault(strategy Strategy) {
	DefaultRegistry.Register(strategy)
}

// InitDefaultStrategies registers all built-in strategies
func InitDefaultStrategies() {
	RegisterDefault(NewAVWAPProximityStrategy())
	RegisterDefault(NewWeek52ExtremesStrategy())
	RegisterDefault(NewVolumeBreakoutStrategy())
	RegisterDefault(NewMomentumStrategy())
}
