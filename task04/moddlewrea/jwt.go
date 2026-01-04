// 中间件文件（如 middleware/jwt.go）
package middleware

import (
	"net/http"
	"strings"
	"task04/utils"

	// 替换为你的工具包路径

	"github.com/gin-gonic/gin"
)

func JWTMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {

		// 1.从前端提取token，前端需要按照要求传递token，格式为：Authorization: Bearer <token>
		authHander := c.GetHeader("Authorization")
		if authHander == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "请先登录",
			})
			c.Abort()
			return
		}

		// 2.校验token格式是否以Bearer开头
		parts := strings.SplitN(authHander, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "Token 格式错误（正确格式：Bearer <token>）",
			})
			c.Abort()
			return
		}
		tokenStr := parts[1]

		// 3.提取真正的token字符串

		claims, err := utils.ParseToken(tokenStr)
		if err != nil {
			// 解析失败（token 过期\签名无效\签名无效）
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 401,
				"msg":  "Token 无效或已过期：" + err.Error(),
			})
			c.Abort()
			return
		}

		// 4.将获取到的token信息注入Gin上下文，供后续的接口使用
		c.Set("user_id", claims.UserID)

		c.Next()

	}
}
