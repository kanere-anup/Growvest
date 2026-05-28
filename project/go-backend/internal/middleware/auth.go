package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/auth"
	"github.com/growvest/stock-screener/internal/config"
)

const (
	// Context keys
	ContextUserID    = "user_id"
	ContextUserEmail = "user_email"
	ContextUserRole  = "user_role"
	ContextClaims    = "claims"
)

// AuthMiddleware creates JWT authentication middleware
func AuthMiddleware(jwtManager *auth.JWTManager, cfg *config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		// Try to get token from cookie first
		if cookieToken, err := c.Cookie(cfg.AccessCookieName); err == nil && cookieToken != "" {
			token = cookieToken
		}

		// Fallback to Authorization header
		if token == "" {
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
					token = parts[1]
				}
			}
		}

		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Authentication required",
			})
			return
		}

		// Validate token
		claims, err := jwtManager.ValidateAccessToken(token)
		if err != nil {
			status := http.StatusUnauthorized
			message := "Invalid token"
			
			if err == auth.ErrExpiredToken {
				message = "Token has expired"
			}

			c.AbortWithStatusJSON(status, gin.H{
				"error":   "unauthorized",
				"message": message,
			})
			return
		}

		// Set user info in context
		c.Set(ContextUserID, claims.UserID)
		c.Set(ContextUserEmail, claims.Email)
		c.Set(ContextUserRole, claims.Role)
		c.Set(ContextClaims, claims)

		c.Next()
	}
}

// CSRFMiddleware validates CSRF token for state-changing requests
func CSRFMiddleware(cfg *config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only validate for state-changing methods
		method := c.Request.Method
		if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
			c.Next()
			return
		}

		// Get CSRF token from cookie
		cookieToken, err := c.Cookie(cfg.CSRFCookieName)
		if err != nil || cookieToken == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "CSRF token missing",
			})
			return
		}

		// Get CSRF token from header
		headerToken := c.GetHeader("X-CSRF-Token")
		if headerToken == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "CSRF header missing",
			})
			return
		}

		// Compare tokens (double-submit pattern)
		if cookieToken != headerToken {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "CSRF validation failed",
			})
			return
		}

		c.Next()
	}
}

// RequireRole creates middleware that requires a specific role
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get(ContextUserRole)
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "Access denied",
			})
			return
		}

		role := userRole.(string)
		for _, r := range roles {
			if role == r {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error":   "forbidden",
			"message": "Insufficient permissions",
		})
	}
}

// GetUserID extracts user ID from context
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get(ContextUserID)
	if !exists {
		return uuid.Nil, false
	}
	return userID.(uuid.UUID), true
}

// GetUserEmail extracts user email from context
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get(ContextUserEmail)
	if !exists {
		return "", false
	}
	return email.(string), true
}

