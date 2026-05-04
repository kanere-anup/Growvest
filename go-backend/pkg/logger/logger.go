package logger

import (
	"context"
	"io"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// Logger wraps zerolog.Logger with additional context methods
type Logger struct {
	zl zerolog.Logger
}

// Config holds logger configuration
type Config struct {
	Level      string
	Format     string // "json" or "console"
	TimeFormat string
	Caller     bool
}

// ContextKey for request-scoped logger
type contextKey string

const (
	LoggerKey    contextKey = "logger"
	RequestIDKey contextKey = "request_id"
)

var (
	// Global logger instance
	globalLogger *Logger
)

// New creates a new logger with the given configuration
func New(cfg Config) *Logger {
	// Set time format
	if cfg.TimeFormat != "" {
		zerolog.TimeFieldFormat = cfg.TimeFormat
	} else {
		zerolog.TimeFieldFormat = time.RFC3339
	}

	// Set output writer based on format
	var writer io.Writer = os.Stdout
	if cfg.Format == "console" || cfg.Format == "" {
		writer = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}
	}

	// Create logger
	zl := zerolog.New(writer).With().Timestamp().Logger()

	// Add caller info if enabled
	if cfg.Caller {
		zl = zl.With().Caller().Logger()
	}

	// Set log level
	level := parseLevel(cfg.Level)
	zl = zl.Level(level)

	logger := &Logger{zl: zl}
	globalLogger = logger

	return logger
}

// Default returns a default logger
func Default() *Logger {
	if globalLogger != nil {
		return globalLogger
	}
	return New(Config{
		Level:  "info",
		Format: "console",
	})
}

// parseLevel converts string to zerolog.Level
func parseLevel(level string) zerolog.Level {
	switch level {
	case "debug":
		return zerolog.DebugLevel
	case "info":
		return zerolog.InfoLevel
	case "warn", "warning":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	case "fatal":
		return zerolog.FatalLevel
	case "panic":
		return zerolog.PanicLevel
	case "trace":
		return zerolog.TraceLevel
	default:
		return zerolog.InfoLevel
	}
}

// --- Logging methods ---

// Debug logs at debug level
func (l *Logger) Debug() *zerolog.Event {
	return l.zl.Debug()
}

// Info logs at info level
func (l *Logger) Info() *zerolog.Event {
	return l.zl.Info()
}

// Warn logs at warn level
func (l *Logger) Warn() *zerolog.Event {
	return l.zl.Warn()
}

// Error logs at error level
func (l *Logger) Error() *zerolog.Event {
	return l.zl.Error()
}

// Fatal logs at fatal level and exits
func (l *Logger) Fatal() *zerolog.Event {
	return l.zl.Fatal()
}

// Panic logs at panic level and panics
func (l *Logger) Panic() *zerolog.Event {
	return l.zl.Panic()
}

// --- Context-aware logging ---

// With returns a logger with additional fields
func (l *Logger) With() zerolog.Context {
	return l.zl.With()
}

// WithFields returns a new logger with additional fields
func (l *Logger) WithFields(fields map[string]interface{}) *Logger {
	ctx := l.zl.With()
	for k, v := range fields {
		ctx = ctx.Interface(k, v)
	}
	return &Logger{zl: ctx.Logger()}
}

// WithComponent returns a logger tagged with a component name
func (l *Logger) WithComponent(component string) *Logger {
	return &Logger{
		zl: l.zl.With().Str("component", component).Logger(),
	}
}

// WithRequestID returns a logger with request ID
func (l *Logger) WithRequestID(requestID string) *Logger {
	return &Logger{
		zl: l.zl.With().Str("request_id", requestID).Logger(),
	}
}

// WithUserID returns a logger with user ID
func (l *Logger) WithUserID(userID uuid.UUID) *Logger {
	return &Logger{
		zl: l.zl.With().Str("user_id", userID.String()).Logger(),
	}
}

// WithError returns a logger with error field
func (l *Logger) WithError(err error) *Logger {
	return &Logger{
		zl: l.zl.With().Err(err).Logger(),
	}
}

// --- Context helpers ---

// FromContext retrieves logger from context
func FromContext(ctx context.Context) *Logger {
	if l, ok := ctx.Value(LoggerKey).(*Logger); ok {
		return l
	}
	return Default()
}

// ToContext stores logger in context
func ToContext(ctx context.Context, l *Logger) context.Context {
	return context.WithValue(ctx, LoggerKey, l)
}

// FromGinContext retrieves logger from Gin context
func FromGinContext(c *gin.Context) *Logger {
	if l, exists := c.Get(string(LoggerKey)); exists {
		if logger, ok := l.(*Logger); ok {
			return logger
		}
	}
	return Default()
}

// --- Global functions for convenience ---

// Debug logs at debug level using global logger
func Debug() *zerolog.Event {
	return Default().Debug()
}

// Info logs at info level using global logger
func Info() *zerolog.Event {
	return Default().Info()
}

// Warn logs at warn level using global logger
func Warn() *zerolog.Event {
	return Default().Warn()
}

// Error logs at error level using global logger
func Error() *zerolog.Event {
	return Default().Error()
}

// Fatal logs at fatal level using global logger and exits
func Fatal() *zerolog.Event {
	return Default().Fatal()
}

// Component returns a logger tagged with component name
func Component(name string) *Logger {
	return Default().WithComponent(name)
}
