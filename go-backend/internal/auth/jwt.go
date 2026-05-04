package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/growvest/stock-screener/internal/config"
)

var (
	ErrInvalidToken  = errors.New("invalid token")
	ErrExpiredToken  = errors.New("token has expired")
	ErrInvalidClaims = errors.New("invalid token claims")
	ErrMissingSecret = errors.New("JWT secret is not configured")
)

// Claims represents JWT token claims
type Claims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

// TokenPair contains access and refresh tokens
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// JWTManager handles JWT token operations
type JWTManager struct {
	secret            []byte
	accessExpiryMins  time.Duration
	refreshExpiryDays time.Duration
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(cfg *config.JWTConfig) (*JWTManager, error) {
	if cfg.Secret == "" {
		return nil, ErrMissingSecret
	}

	return &JWTManager{
		secret:            []byte(cfg.Secret),
		accessExpiryMins:  cfg.AccessExpiryMins,
		refreshExpiryDays: cfg.RefreshExpiryDays,
	}, nil
}

// GenerateAccessToken creates a new JWT access token
func (m *JWTManager) GenerateAccessToken(userID uuid.UUID, email, role string) (string, time.Time, error) {
	expiresAt := time.Now().Add(m.accessExpiryMins)

	claims := &Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "growvest",
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, err
	}

	return signedToken, expiresAt, nil
}

// ValidateAccessToken validates and parses a JWT access token
func (m *JWTManager) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidClaims
	}

	return claims, nil
}

// GenerateRefreshToken creates a cryptographically secure refresh token
func (m *JWTManager) GenerateRefreshToken() (string, string, time.Time, error) {
	// Generate 48 bytes of random data (64 chars when base64 encoded)
	tokenBytes := make([]byte, 48)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", "", time.Time{}, err
	}

	token := base64.URLEncoding.EncodeToString(tokenBytes)
	hash := HashToken(token)
	expiresAt := time.Now().Add(m.refreshExpiryDays)

	return token, hash, expiresAt, nil
}

// GenerateCSRFToken creates a CSRF token for double-submit pattern
func GenerateCSRFToken() (string, error) {
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(tokenBytes), nil
}

// RefreshExpiry returns the refresh token expiry duration
func (m *JWTManager) RefreshExpiry() time.Duration {
	return m.refreshExpiryDays
}
