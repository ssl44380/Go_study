package global

import (
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var (
	GLOBAL_DB     *gorm.DB
	GLOBAL_Logger *zap.Logger
)
