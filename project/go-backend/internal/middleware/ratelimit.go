package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/growvest/stock-screener/internal/models"
)

type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
}

type visitor struct {
	tokens    float64
	lastSeen  time.Time
	maxTokens float64
	refillRate float64 // tokens per second
}

var limiter = &rateLimiter{
	visitors: make(map[string]*visitor),
}

func init() {
	go limiter.cleanup()
}

func (rl *rateLimiter) cleanup() {
	for {
		time.Sleep(5 * time.Minute)
		rl.mu.Lock()
		for key, v := range rl.visitors {
			if time.Since(v.lastSeen) > 10*time.Minute {
				delete(rl.visitors, key)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *rateLimiter) allow(key string, maxTokens, refillRate float64) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[key]
	if !exists {
		rl.visitors[key] = &visitor{
			tokens:     maxTokens - 1,
			lastSeen:   time.Now(),
			maxTokens:  maxTokens,
			refillRate: refillRate,
		}
		return true
	}

	elapsed := time.Since(v.lastSeen).Seconds()
	v.tokens += elapsed * refillRate
	if v.tokens > maxTokens {
		v.tokens = maxTokens
	}
	v.lastSeen = time.Now()

	if v.tokens < 1 {
		return false
	}

	v.tokens--
	return true
}

// RateLimitMiddleware applies per-user rate limiting based on role tier.
// Free users: 30 req/min, Premium: 120 req/min, Admin: 300 req/min.
func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(ContextUserRole)
		roleStr, _ := role.(string)

		var maxTokens, refillRate float64
		switch models.RoleTier(roleStr) {
		case 3: // admin
			maxTokens = 300
			refillRate = 5.0
		case 2: // premium
			maxTokens = 120
			refillRate = 2.0
		default: // free user or unauthenticated
			maxTokens = 30
			refillRate = 0.5
		}

		key := c.ClientIP()
		if userID, exists := c.Get(ContextUserID); exists {
			key = userID.(interface{ String() string }).String()
		}

		if !limiter.allow(key, maxTokens, refillRate) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limited",
				"message": "Too many requests. Please try again later.",
			})
			return
		}

		c.Next()
	}
}

// ScanRateLimitMiddleware limits scan creation per user tier.
// Free: 5 scans/hour, Premium: 30/hour, Admin: unlimited.
func ScanRateLimitMiddleware() gin.HandlerFunc {
	scanLimiter := &rateLimiter{
		visitors: make(map[string]*visitor),
	}
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			scanLimiter.mu.Lock()
			for key, v := range scanLimiter.visitors {
				if time.Since(v.lastSeen) > 1*time.Hour {
					delete(scanLimiter.visitors, key)
				}
			}
			scanLimiter.mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		role, _ := c.Get(ContextUserRole)
		roleStr, _ := role.(string)

		if models.RoleTier(roleStr) >= 3 {
			c.Next()
			return
		}

		var maxTokens, refillRate float64
		switch models.RoleTier(roleStr) {
		case 2:
			maxTokens = 30
			refillRate = 30.0 / 3600
		default:
			maxTokens = 5
			refillRate = 5.0 / 3600
		}

		key := "scan:"
		if userID, exists := c.Get(ContextUserID); exists {
			key += userID.(interface{ String() string }).String()
		} else {
			key += c.ClientIP()
		}

		if !scanLimiter.allow(key, maxTokens, refillRate) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limited",
				"message": "Scan limit reached for your plan. Upgrade to premium for more scans.",
			})
			return
		}

		c.Next()
	}
}
