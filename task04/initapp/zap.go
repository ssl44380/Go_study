package initapp

import (
	"task04/config"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func InitCoustomLevelLogger(appname string) *zap.Logger {

	// 为Info级别创建Core (json格式 写入当天的infol.log)
	infoFileCoreCfg := config.CoustomLoggerCoreCfg{
		LogLevel: config.InfoLogLevel,
		LogDir:   "logs",
		IsColor:  false,
		IsJson:   true,
	}

	infoFileCore := infoFileCoreCfg.InitCore()
	// 为Error级别创建Core （写入到当天的error.log）
	errFileCoreCfg := config.CoustomLoggerCoreCfg{
		LogLevel: config.ErrorLogLevel,
		LogDir:   "logs",
		IsColor:  false,
		IsJson:   true,
	}
	errFileCore := errFileCoreCfg.InitCore()

	// 创建console输出，带颜色，debug级别及其以上级别的日志均在这里输出
	consoleCoreCfg := config.CoustomLoggerCoreCfg{
		IsColor: true,
		IsJson:  false,
	}
	consoleCore := consoleCoreCfg.InitCore()

	// 合并所有的core并创建logger对象
	core := zapcore.NewTee(infoFileCore, errFileCore, consoleCore)
	logger := zap.New(
		core,
		zap.AddCaller(),
		zap.AddStacktrace(zapcore.ErrorLevel),
	).Named(appname)

	return logger
}
