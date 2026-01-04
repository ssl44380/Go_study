package config

import "time"

// 设置jwt过期时间

const (
	JwtSecret           = "myblogapp"
	TokenExpireDuration = time.Hour * 24
)
