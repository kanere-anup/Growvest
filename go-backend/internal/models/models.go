package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// JSONB type for PostgreSQL JSONB columns
type JSONB map[string]interface{}

// Value implements driver.Valuer for JSONB
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements sql.Scanner for JSONB
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, j)
}

// User role constants
const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

// BaseModel contains common fields for all models
type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CreatedAt time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time      `gorm:"not null;default:now()" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// BeforeCreate generates UUID before insert
func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// User represents an application user
type User struct {
	BaseModel
	Email        string `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string `gorm:"type:varchar(255);not null" json:"-"`
	FullName     string `gorm:"type:varchar(255)" json:"full_name"`
	Role         string `gorm:"type:varchar(50);default:'user'" json:"role"`
	IsActive     bool   `gorm:"default:true" json:"is_active"`
	IsVerified   bool   `gorm:"default:false" json:"is_verified"`

	// Relationships
	RefreshSessions []RefreshSession `gorm:"foreignKey:UserID" json:"-"`
	UserStocks      []UserStock      `gorm:"foreignKey:UserID" json:"-"`
	UserStrategies  []UserStrategy   `gorm:"foreignKey:UserID" json:"-"`
	Scans           []Scan           `gorm:"foreignKey:UserID" json:"-"`
	Reports         []Report         `gorm:"foreignKey:UserID" json:"-"`
}

// TableName sets the table name for User
func (User) TableName() string {
	return "users"
}

// RefreshSession stores refresh token sessions for JWT rotation
type RefreshSession struct {
	ID         uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID  `gorm:"type:uuid;index;not null" json:"user_id"`
	TokenHash  string     `gorm:"type:varchar(128);uniqueIndex;not null" json:"-"`
	UserAgent  string     `gorm:"type:varchar(512)" json:"user_agent"`
	IPAddress  string     `gorm:"type:varchar(64)" json:"ip_address"`
	ExpiresAt  time.Time  `gorm:"not null" json:"expires_at"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
	ReplacedBy string     `gorm:"type:varchar(128)" json:"-"`
	CreatedAt  time.Time  `gorm:"not null;default:now()" json:"created_at"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName sets the table name for RefreshSession
func (RefreshSession) TableName() string {
	return "refresh_sessions"
}

// Stock represents a tradable stock
type Stock struct {
	BaseModel
	Symbol    string  `gorm:"type:varchar(20);uniqueIndex;not null" json:"symbol"`
	Exchange  string  `gorm:"type:varchar(20);default:'NSE'" json:"exchange"`
	Name      string  `gorm:"type:varchar(255)" json:"name"`
	Sector    string  `gorm:"type:varchar(100)" json:"sector"`
	MarketCap float64 `gorm:"type:decimal(20,2)" json:"market_cap"`
	IsActive  bool    `gorm:"default:true" json:"is_active"`
	Metadata  JSONB   `gorm:"type:jsonb" json:"metadata,omitempty"`

	// Relationships
	UserStocks  []UserStock  `gorm:"foreignKey:StockID" json:"-"`
	ScanStocks  []ScanStock  `gorm:"foreignKey:StockID" json:"-"`
	ScanResults []ScanResult `gorm:"foreignKey:StockID" json:"-"`
}

// TableName sets the table name for Stock
func (Stock) TableName() string {
	return "stocks"
}

// FullSymbol returns the fully qualified symbol (e.g., RELIANCE.NS)
func (s *Stock) FullSymbol() string {
	if s.Exchange != "" {
		return s.Symbol + "." + s.Exchange
	}
	return s.Symbol
}

// UserStock represents a user's stock watchlist entry
type UserStock struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	StockID    uuid.UUID `gorm:"type:uuid;not null" json:"stock_id"`
	Notes      string    `gorm:"type:text" json:"notes"`
	IsFavorite bool      `gorm:"default:false" json:"is_favorite"`
	CreatedAt  time.Time `gorm:"not null;default:now()" json:"created_at"`

	// Relationships
	User  User  `gorm:"foreignKey:UserID" json:"-"`
	Stock Stock `gorm:"foreignKey:StockID" json:"stock,omitempty"`
}

// TableName sets the table name for UserStock
func (UserStock) TableName() string {
	return "user_stocks"
}

// Strategy represents a screening strategy definition
type Strategy struct {
	BaseModel
	Name        string     `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	DisplayName string     `gorm:"type:varchar(200);not null" json:"display_name"`
	Description string     `gorm:"type:text" json:"description"`
	Category    string     `gorm:"type:varchar(50)" json:"category"`
	Parameters  JSONB      `gorm:"type:jsonb" json:"parameters"`
	IsSystem    bool       `gorm:"default:false" json:"is_system"`
	IsActive    bool       `gorm:"default:true" json:"is_active"`
	CreatedBy   *uuid.UUID `gorm:"type:uuid" json:"created_by,omitempty"`

	// Relationships
	Creator        *User          `gorm:"foreignKey:CreatedBy" json:"-"`
	UserStrategies []UserStrategy `gorm:"foreignKey:StrategyID" json:"-"`
	ScanResults    []ScanResult   `gorm:"foreignKey:StrategyID" json:"-"`
}

// TableName sets the table name for Strategy
func (Strategy) TableName() string {
	return "strategies"
}

// UserStrategy represents a user's configured strategy
type UserStrategy struct {
	BaseModel
	UserID     uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	StrategyID uuid.UUID `gorm:"type:uuid;not null" json:"strategy_id"`
	CustomName string    `gorm:"type:varchar(200)" json:"custom_name"`
	Parameters JSONB     `gorm:"type:jsonb" json:"parameters"`
	IsEnabled  bool      `gorm:"default:true" json:"is_enabled"`
	Priority   int       `gorm:"default:0" json:"priority"`

	// Relationships
	User           User           `gorm:"foreignKey:UserID" json:"-"`
	Strategy       Strategy       `gorm:"foreignKey:StrategyID" json:"strategy,omitempty"`
	ScanStrategies []ScanStrategy `gorm:"foreignKey:UserStrategyID" json:"-"`
}

// TableName sets the table name for UserStrategy
func (UserStrategy) TableName() string {
	return "user_strategies"
}

// Scan represents a scan execution session
type Scan struct {
	BaseModel
	UserID           uuid.UUID  `gorm:"type:uuid;index;not null" json:"user_id"`
	Name             string     `gorm:"type:varchar(255)" json:"name"`
	Status           string     `gorm:"type:varchar(20);not null;default:'pending'" json:"status"`
	TotalStocks      int        `gorm:"default:0" json:"total_stocks"`
	ProcessedStocks  int        `gorm:"default:0" json:"processed_stocks"`
	SuccessfulStocks int        `gorm:"default:0" json:"successful_stocks"`
	FailedStocks     int        `gorm:"default:0" json:"failed_stocks"`
	ExecutionTimeMs  int        `json:"execution_time_ms"`
	ErrorMessage     string     `gorm:"type:text" json:"error_message,omitempty"`
	Metadata         JSONB      `gorm:"type:jsonb" json:"metadata,omitempty"`
	StartedAt        *time.Time `json:"started_at,omitempty"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`

	// Relationships
	User           User           `gorm:"foreignKey:UserID" json:"-"`
	ScanStocks     []ScanStock    `gorm:"foreignKey:ScanID" json:"-"`
	ScanStrategies []ScanStrategy `gorm:"foreignKey:ScanID" json:"-"`
	ScanResults    []ScanResult   `gorm:"foreignKey:ScanID" json:"-"`
	Reports        []Report       `gorm:"foreignKey:ScanID" json:"-"`
}

// TableName sets the table name for Scan
func (Scan) TableName() string {
	return "scans"
}

// ScanStatus constants
const (
	ScanStatusPending   = "pending"
	ScanStatusRunning   = "running"
	ScanStatusCompleted = "completed"
	ScanStatusFailed    = "failed"
	ScanStatusCancelled = "cancelled"
)

// ScanStock represents stocks included in a scan
type ScanStock struct {
	ID      uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ScanID  uuid.UUID `gorm:"type:uuid;index;not null" json:"scan_id"`
	StockID uuid.UUID `gorm:"type:uuid;not null" json:"stock_id"`

	// Relationships
	Scan  Scan  `gorm:"foreignKey:ScanID" json:"-"`
	Stock Stock `gorm:"foreignKey:StockID" json:"stock,omitempty"`
}

// TableName sets the table name for ScanStock
func (ScanStock) TableName() string {
	return "scan_stocks"
}

// ScanStrategy represents strategies used in a scan
type ScanStrategy struct {
	ID                 uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ScanID             uuid.UUID `gorm:"type:uuid;index;not null" json:"scan_id"`
	UserStrategyID     uuid.UUID `gorm:"type:uuid;not null" json:"user_strategy_id"`
	ParametersSnapshot JSONB     `gorm:"type:jsonb" json:"parameters_snapshot"`

	// Relationships
	Scan         Scan         `gorm:"foreignKey:ScanID" json:"-"`
	UserStrategy UserStrategy `gorm:"foreignKey:UserStrategyID" json:"user_strategy,omitempty"`
}

// TableName sets the table name for ScanStrategy
func (ScanStrategy) TableName() string {
	return "scan_strategies"
}

// ScanResult represents individual scan results
type ScanResult struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ScanID       uuid.UUID `gorm:"type:uuid;index;not null" json:"scan_id"`
	StockID      uuid.UUID `gorm:"type:uuid;index;not null" json:"stock_id"`
	StrategyID   uuid.UUID `gorm:"type:uuid;index;not null" json:"strategy_id"`
	Symbol       string    `gorm:"type:varchar(20);index;not null" json:"symbol"`
	CurrentPrice float64   `gorm:"type:decimal(12,4)" json:"current_price"`
	ResultData   JSONB     `gorm:"type:jsonb" json:"result_data"`
	Score        float64   `gorm:"type:decimal(10,4)" json:"score"`
	Signal       string    `gorm:"type:varchar(20)" json:"signal"`
	CreatedAt    time.Time `gorm:"not null;index;default:now()" json:"created_at"`

	// Relationships
	Scan     Scan     `gorm:"foreignKey:ScanID" json:"-"`
	Stock    Stock    `gorm:"foreignKey:StockID" json:"stock,omitempty"`
	Strategy Strategy `gorm:"foreignKey:StrategyID" json:"strategy,omitempty"`
}

// TableName sets the table name for ScanResult
func (ScanResult) TableName() string {
	return "scan_results"
}

// Signal constants
const (
	SignalBuy     = "buy"
	SignalSell    = "sell"
	SignalHold    = "hold"
	SignalNeutral = "neutral"
)

// Report represents generated analysis reports
type Report struct {
	BaseModel
	UserID    uuid.UUID  `gorm:"type:uuid;index;not null" json:"user_id"`
	ScanID    uuid.UUID  `gorm:"type:uuid" json:"scan_id"`
	Name      string     `gorm:"type:varchar(255);not null" json:"name"`
	Type      string     `gorm:"type:varchar(50)" json:"type"`
	FilePath  string     `gorm:"type:varchar(512)" json:"file_path"`
	FileSize  int        `json:"file_size"`
	Metadata  JSONB      `gorm:"type:jsonb" json:"metadata,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"-"`
	Scan Scan `gorm:"foreignKey:ScanID" json:"scan,omitempty"`
}

// TableName sets the table name for Report
func (Report) TableName() string {
	return "reports"
}

// ReportType constants
const (
	ReportTypeExcel   = "excel"
	ReportTypePDF     = "pdf"
	ReportTypeSummary = "summary"
)
