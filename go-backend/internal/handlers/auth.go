package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/auth"
	"github.com/growvest/stock-screener/internal/config"
	"github.com/growvest/stock-screener/internal/middleware"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	userRepo   *repository.UserRepository
	jwtManager *auth.JWTManager
	cfg        *config.Config
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(userRepo *repository.UserRepository, jwtManager *auth.JWTManager, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		userRepo:   userRepo,
		jwtManager: jwtManager,
		cfg:        cfg,
	}
}

// RegisterRequest is the request body for registration
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	FullName string `json:"full_name"`
}

// LoginRequest is the request body for login
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UserResponse is the response for user data
type UserResponse struct {
	ID         uuid.UUID `json:"id"`
	Email      string    `json:"email"`
	FullName   string    `json:"full_name"`
	Role       string    `json:"role"`
	IsVerified bool      `json:"is_verified"`
	CreatedAt  time.Time `json:"created_at"`
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation_error",
			"message": err.Error(),
		})
		return
	}

	// Check if user already exists
	exists, err := h.userRepo.ExistsByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Failed to check email",
		})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "conflict",
			"message": "Email already registered",
		})
		return
	}

	// Hash password
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation_error",
			"message": err.Error(),
		})
		return
	}

	// Create user
	user := &models.User{
		Email:        req.Email,
		PasswordHash: passwordHash,
		FullName:     req.FullName,
		Role:         "user",
		IsActive:     true,
		IsVerified:   false,
	}

	if err := h.userRepo.Create(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Failed to create user",
		})
		return
	}

	c.JSON(http.StatusCreated, UserResponse{
		ID:         user.ID,
		Email:      user.Email,
		FullName:   user.FullName,
		Role:       user.Role,
		IsVerified: user.IsVerified,
		CreatedAt:  user.CreatedAt,
	})
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation_error",
			"message": err.Error(),
		})
		return
	}

	// Get user by email
	user, err := h.userRepo.GetByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Invalid credentials",
		})
		return
	}

	// Check password
	if !auth.VerifyPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Invalid credentials",
		})
		return
	}

	// Check if user is active
	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "forbidden",
			"message": "Account is disabled",
		})
		return
	}

	// Generate tokens
	accessToken, expiresAt, err := h.jwtManager.GenerateAccessToken(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Failed to generate token",
		})
		return
	}

	refreshToken, tokenHash, refreshExpiresAt, err := h.jwtManager.GenerateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Failed to generate refresh token",
		})
		return
	}

	// Store refresh session
	session := &models.RefreshSession{
		UserID:    user.ID,
		TokenHash: tokenHash,
		UserAgent: c.Request.UserAgent(),
		IPAddress: c.ClientIP(),
		ExpiresAt: refreshExpiresAt,
	}
	if err := h.userRepo.CreateRefreshSession(c.Request.Context(), session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Failed to create session",
		})
		return
	}

	// Generate CSRF token
	csrfToken, _ := auth.GenerateCSRFToken()

	// Set cookies
	h.setAuthCookies(c, accessToken, refreshToken, csrfToken, expiresAt, refreshExpiresAt)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"user": UserResponse{
			ID:         user.ID,
			Email:      user.Email,
			FullName:   user.FullName,
			Role:       user.Role,
			IsVerified: user.IsVerified,
			CreatedAt:  user.CreatedAt,
		},
	})
}

// Refresh handles token refresh
func (h *AuthHandler) Refresh(c *gin.Context) {
	refreshToken, err := c.Cookie(h.cfg.JWT.RefreshCookieName)
	if err != nil || refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Refresh token missing",
		})
		return
	}

	// Hash the token to find session
	tokenHash := auth.HashToken(refreshToken)
	session, err := h.userRepo.GetRefreshSession(c.Request.Context(), tokenHash)
	if err != nil || session == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Invalid refresh token",
		})
		return
	}

	// Check if revoked or expired
	if session.RevokedAt != nil || session.ExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Token expired or revoked",
		})
		return
	}

	// Get user
	user, err := h.userRepo.GetByID(c.Request.Context(), session.UserID)
	if err != nil || !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User not found or inactive",
		})
		return
	}

	// Generate new tokens
	accessToken, expiresAt, err := h.jwtManager.GenerateAccessToken(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Failed to generate token",
		})
		return
	}

	newRefreshToken, newTokenHash, refreshExpiresAt, err := h.jwtManager.GenerateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Failed to generate refresh token",
		})
		return
	}

	// Rotate: revoke old session
	_ = h.userRepo.RevokeRefreshSession(c.Request.Context(), tokenHash, newTokenHash)

	// Create new session
	newSession := &models.RefreshSession{
		UserID:    user.ID,
		TokenHash: newTokenHash,
		UserAgent: c.Request.UserAgent(),
		IPAddress: c.ClientIP(),
		ExpiresAt: refreshExpiresAt,
	}
	if err := h.userRepo.CreateRefreshSession(c.Request.Context(), newSession); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "internal_error",
			"message": "Failed to create session",
		})
		return
	}

	// Generate new CSRF token
	csrfToken, _ := auth.GenerateCSRFToken()

	// Set cookies
	h.setAuthCookies(c, accessToken, newRefreshToken, csrfToken, expiresAt, refreshExpiresAt)

	c.JSON(http.StatusOK, gin.H{"message": "Token refreshed"})
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	// Revoke refresh token if present
	if refreshToken, err := c.Cookie(h.cfg.JWT.RefreshCookieName); err == nil && refreshToken != "" {
		tokenHash := auth.HashToken(refreshToken)
		_ = h.userRepo.RevokeRefreshSession(c.Request.Context(), tokenHash, "")
	}

	// Clear cookies
	h.clearAuthCookies(c)

	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

// Me returns current user info
func (h *AuthHandler) Me(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Not authenticated",
		})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "not_found",
			"message": "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		ID:         user.ID,
		Email:      user.Email,
		FullName:   user.FullName,
		Role:       user.Role,
		IsVerified: user.IsVerified,
		CreatedAt:  user.CreatedAt,
	})
}

// setAuthCookies sets authentication cookies
func (h *AuthHandler) setAuthCookies(c *gin.Context, accessToken, refreshToken, csrfToken string, accessExpires, refreshExpires time.Time) {
	secure := h.cfg.App.Env == "production"

	// Access token cookie (HttpOnly)
	c.SetCookie(
		h.cfg.JWT.AccessCookieName,
		accessToken,
		int(time.Until(accessExpires).Seconds()),
		"/",
		"",
		secure,
		true, // HttpOnly
	)

	// Refresh token cookie (HttpOnly)
	c.SetCookie(
		h.cfg.JWT.RefreshCookieName,
		refreshToken,
		int(time.Until(refreshExpires).Seconds()),
		"/",
		"",
		secure,
		true, // HttpOnly
	)

	// CSRF token cookie (accessible by JavaScript)
	c.SetCookie(
		h.cfg.JWT.CSRFCookieName,
		csrfToken,
		int(time.Until(accessExpires).Seconds()),
		"/",
		"",
		secure,
		false, // Not HttpOnly - needs to be read by JS
	)
}

// clearAuthCookies clears authentication cookies
func (h *AuthHandler) clearAuthCookies(c *gin.Context) {
	secure := h.cfg.App.Env == "production"

	c.SetCookie(h.cfg.JWT.AccessCookieName, "", -1, "/", "", secure, true)
	c.SetCookie(h.cfg.JWT.RefreshCookieName, "", -1, "/", "", secure, true)
	c.SetCookie(h.cfg.JWT.CSRFCookieName, "", -1, "/", "", secure, false)
}
