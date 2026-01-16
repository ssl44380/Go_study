package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

type Loglevel int8

const (
	DebugLogLevel Loglevel = iota - 1
	InfoLogLevel
	WarnLogLevel
	ErrorLogLevel
	DPanicLogLevel
	PanicLogLevel
	FatalLogLevel
)

type CoustomLoggerCoreCfg struct {
	LogLevel Loglevel
	LogDir   string
	IsColor  bool
	IsJson   bool
}

func (c CoustomLoggerCoreCfg) InitCore() zapcore.Core {
	cfg := zapcore.EncoderConfig{
		NameKey:       "appname",
		TimeKey:       "time",
		LevelKey:      "level",
		CallerKey:     "caller",
		MessageKey:    "message",
		StacktraceKey: "stack",
		EncodeCaller:  zapcore.ShortCallerEncoder,
		EncodeTime:    zapcore.TimeEncoderOfLayout("2006-01-02 15:04:05"),
		LineEnding:    zapcore.DefaultLineEnding,
	}

	if c.IsColor {
		cfg.EncodeLevel = zapcore.CapitalColorLevelEncoder
	} else {
		cfg.EncodeLevel = zapcore.CapitalLevelEncoder
	}

	var encoder zapcore.Encoder
	if c.IsJson {
		encoder = zapcore.NewJSONEncoder(cfg)
	} else {
		encoder = zapcore.NewConsoleEncoder(cfg)
	}

	// 创建文件输出core
	if c.LogDir != "" {
		coustomWriter := buildLeveledWriter(c.LogDir, c.LogLevel)
		return zapcore.NewCore(
			encoder,
			coustomWriter,
			zap.LevelEnablerFunc(func(l zapcore.Level) bool {
				return l == zapcore.Level(c.LogLevel)
			}),
		)
	}
	return zapcore.NewCore(
		encoder,
		zapcore.AddSync(os.Stdout),
		zapcore.DebugLevel,
	)
}

func buildLeveledWriter(logDir string, level Loglevel) zapcore.WriteSyncer {
	taday := time.Now().Format("2006-01-02")
	dayDir := filepath.Join(logDir, taday)
	_ = os.MkdirAll(dayDir, 0755)
	logPath := filepath.Join(dayDir, level.String()+".log")

	return zapcore.AddSync(&lumberjack.Logger{
		Filename:   logPath,
		MaxSize:    100,
		MaxAge:     7,
		MaxBackups: 10,
		Compress:   true,
	})
}

func (l Loglevel) String() string {
	switch l {
	case DebugLogLevel:
		return "debug"
	case InfoLogLevel:
		return "info"
	case WarnLogLevel:
		return "warn"
	case ErrorLogLevel:
		return "error"
	case DPanicLogLevel:
		return "dpanic"
	case PanicLogLevel:
		return "panic"
	case FatalLogLevel:
		return "fatal"
	default:
		return fmt.Sprintf("Loglevel(%d)", l)
	}
}
