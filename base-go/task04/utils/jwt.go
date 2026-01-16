// 工具文件（如 utils/jwt.go）
package utils

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"task04/config" // 替换为你的配置包路径

	"github.com/golang-jwt/jwt/v5"
)

// 定义一个jwt中自定义配置的字段，例如携带用于id等信息

type ConstomClaims struct {
	UserID uint `json:"user_id"`
	jwt.RegisteredClaims
}

func GenerateToken(UserID uint) (string, error) {
	// 构造claims
	claims := ConstomClaims{
		UserID: UserID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(config.TokenExpireDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "my_blog_app",
		},
	}

	// 使用HS256算法token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 使用秘钥对token进行签名，并返回
	// return token.SignedString([]byte(config.JwtSecret))
	return token.SignedString([]byte(config.JwtSecret))
}

func ParseToken(tokenStr string) (*ConstomClaims, error) {
	token, err := jwt.ParseWithClaims(
		tokenStr,
		&ConstomClaims{},
		func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("无效的签名算法")
			}
			return []byte(config.JwtSecret), nil
		},
	)
	// 解析失败token无效、过期、签名错误
	if err != nil {
		return nil, err
	}
	// 检验token有效，并提取token
	if claims, ok := token.Claims.(*ConstomClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, errors.New("无效的token")

}

func AnyToUint(v any) (uint, error) {
	if v == nil {
		return 0, errors.New("转换失败：值为 nil")
	}

	switch val := v.(type) {
	// 1. 底层已是 uint，直接返回
	case uint:
		return val, nil

	// 2. 底层是 int（需校验非负，避免负数转 uint 溢出）
	case int:
		if val < 0 {
			return 0, fmt.Errorf("转换失败：int 类型值为负数（%d），无法转为 uint", val)
		}
		return uint(val), nil

	// 3. 底层是 string（需解析为数字后转 uint）
	case string:
		// 先解析为 uint64（兼容更大数值），再转 uint
		num, err := strconv.ParseUint(val, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("转换失败：字符串「%s」无法解析为 uint（%v）", val, err)
		}
		return uint(num), nil

	// 4. 底层是 float64（JSON 解析数字默认类型，需校验是整数）
	case float64:
		// 校验：非负 + 是整数（无小数部分）
		if val < 0 || math.Mod(val, 1) != 0 {
			return 0, fmt.Errorf("转换失败：float64 类型值「%f」非正整数", val)
		}
		return uint(val), nil

	// 5. 其他数值类型（uint64/int64）
	case uint64:
		return uint(val), nil
	case int64:
		if val < 0 {
			return 0, fmt.Errorf("转换失败：int64 类型值为负数（%d）", val)
		}
		return uint(val), nil

	// 6. 不支持的类型
	default:
		return 0, fmt.Errorf("转换失败：不支持的类型「%T」（值：%v）", val, val)
	}
}
