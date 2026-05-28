package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/growvest/stock-screener/internal/auth"
	"github.com/growvest/stock-screener/internal/config"
	"github.com/growvest/stock-screener/internal/models"
	"github.com/growvest/stock-screener/internal/repository"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type OAuthHandler struct {
	userRepo   *repository.UserRepository
	jwtManager *auth.JWTManager
	cfg        *config.Config
	googleCfg  *oauth2.Config
}

func NewOAuthHandler(userRepo *repository.UserRepository, jwtManager *auth.JWTManager, cfg *config.Config) *OAuthHandler {
	h := &OAuthHandler{
		userRepo:   userRepo,
		jwtManager: jwtManager,
		cfg:        cfg,
	}

	if cfg.OAuth.GoogleClientID != "" {
		h.googleCfg = &oauth2.Config{
			ClientID:     cfg.OAuth.GoogleClientID,
			ClientSecret: cfg.OAuth.GoogleClientSecret,
			RedirectURL:  cfg.OAuth.GoogleRedirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}

	return h
}

func (h *OAuthHandler) GoogleLogin(c *gin.Context) {
	if h.googleCfg == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google OAuth not configured"})
		return
	}

	state := generateState()
	c.SetCookie("oauth_state", state, 300, "/", "", h.cfg.App.Env == "production", true)

	url := h.googleCfg.AuthCodeURL(state, oauth2.AccessTypeOffline)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func (h *OAuthHandler) GoogleCallback(c *gin.Context) {
	if h.googleCfg == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google OAuth not configured"})
		return
	}

	// Verify state
	savedState, err := c.Cookie("oauth_state")
	if err != nil || savedState != c.Query("state") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state parameter"})
		return
	}

	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing authorization code"})
		return
	}

	// Exchange code for token
	token, err := h.googleCfg.Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange token"})
		return
	}

	// Get user info from Google
	googleUser, err := h.fetchGoogleUserInfo(token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}

	// Find or create user
	user, err := h.findOrCreateOAuthUser(c.Request.Context(), googleUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process user"})
		return
	}

	// Generate JWT tokens and set cookies (same as regular login)
	h.issueTokens(c, user)

	// Redirect to frontend
	frontendURL := "http://localhost:3000"
	if len(h.cfg.CORS.AllowedOrigins) > 0 {
		frontendURL = h.cfg.CORS.AllowedOrigins[0]
	}
	c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/dashboard")
}

type googleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (h *OAuthHandler) fetchGoogleUserInfo(token *oauth2.Token) (*googleUserInfo, error) {
	client := h.googleCfg.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var userInfo googleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	return &userInfo, nil
}

func (h *OAuthHandler) findOrCreateOAuthUser(ctx context.Context, googleUser *googleUserInfo) (*models.User, error) {
	user, err := h.userRepo.GetByEmail(ctx, googleUser.Email)
	if err == nil {
		// Existing user — mark as verified if Google says so
		if googleUser.EmailVerified && !user.IsVerified {
			user.IsVerified = true
			_ = h.userRepo.Update(ctx, user)
		}
		return user, nil
	}

	// Create new user (no password — OAuth only)
	dummyHash, _ := auth.HashPassword(generateState() + generateState())
	user = &models.User{
		Email:        googleUser.Email,
		PasswordHash: dummyHash,
		FullName:     googleUser.Name,
		Role:         models.RoleUser,
		IsActive:     true,
		IsVerified:   googleUser.EmailVerified,
	}

	if err := h.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

func (h *OAuthHandler) issueTokens(c *gin.Context, user *models.User) {
	accessToken, expiresAt, err := h.jwtManager.GenerateAccessToken(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	refreshToken, tokenHash, refreshExpiresAt, err := h.jwtManager.GenerateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	session := &models.RefreshSession{
		UserID:    user.ID,
		TokenHash: tokenHash,
		UserAgent: c.Request.UserAgent(),
		IPAddress: c.ClientIP(),
		ExpiresAt: refreshExpiresAt,
	}
	_ = h.userRepo.CreateRefreshSession(c.Request.Context(), session)

	csrfToken, _ := auth.GenerateCSRFToken()

	secure := h.cfg.App.Env == "production"

	c.SetCookie(h.cfg.JWT.AccessCookieName, accessToken, int(time.Until(expiresAt).Seconds()), "/", "", secure, true)
	c.SetCookie(h.cfg.JWT.RefreshCookieName, refreshToken, int(time.Until(refreshExpiresAt).Seconds()), "/", "", secure, true)
	c.SetCookie(h.cfg.JWT.CSRFCookieName, csrfToken, int(time.Until(expiresAt).Seconds()), "/", "", secure, false)
}

func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}
