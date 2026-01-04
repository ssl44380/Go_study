package response

import (
	. "task04/config"

	"github.com/gin-gonic/gin"
)

const (
	SUCCESS = 200
	FAIL    = 500
)

// const (
// 	// DBStatusOK 操作成功：查询/插入/更新/删除执行成功
// 	DBStatusOK ServiceStatusCode = 200

// 	// DBStatusBadRequest 参数错误：SQL 语法错误、参数类型不匹配、主键为空
// 	DBStatusBadRequest ServiceStatusCode = 40001

// 	// DBStatusNotFound 数据不存在：根据 ID 查询无结果、删除/更新不存在的数据
// 	DBStatusNotFound ServiceStatusCode = 40401

// 	// DBStatusConflict 数据冲突：唯一键重复、乐观锁版本冲突、主键重复插入
// 	DBStatusConflict ServiceStatusCode = 40901

// 	// DBStatusUnprocessableEntity 数据校验失败：字段长度超限、格式错误（如手机号/邮箱）
// 	DBStatusUnprocessableEntity ServiceStatusCode = 40002

// 	// DBStatusInternalError 数据库服务异常：数据库连接失败、服务宕机、权限不足
// 	DBStatusInternalError ServiceStatusCode = 50001

// )

func Return(httpCode int, serviceCode ServiceStatusCode, message string, data interface{}, c *gin.Context) {
	c.JSON(httpCode, Response{
		Code:    serviceCode,
		Message: message,
		Data:    data,
	})
}

func SuccessDBStatusOK(message string, c *gin.Context) {
	Return(SUCCESS, DBStatusOK, message, map[string]interface{}{}, c)
}

func SuccessDBStatusWithInfoOK(message string, data interface{}, c *gin.Context) {
	Return(SUCCESS, DBStatusOK, message, data, c)
}

func FailDBStatusUnprocessableEntity(message string, c *gin.Context) {
	Return(FAIL, DBStatusUnprocessableEntity, message, map[string]interface{}{}, c)
}

func FailDBStatusBadRequest(message string, c *gin.Context) {
	Return(FAIL, DBStatusBadRequest, message, map[string]interface{}{}, c)
}

func FailDBStatusConflict(message string, c *gin.Context) {
	Return(FAIL, DBStatusConflict, message, map[string]interface{}{}, c)
}

func FailDBStatusNotFound(message string, c *gin.Context) {
	Return(FAIL, DBStatusNotFound, message, map[string]interface{}{}, c)
}

func FailDBStatusInternalError(message string, c *gin.Context) {
	Return(FAIL, DBStatusInternalError, message, map[string]interface{}{}, c)
}
