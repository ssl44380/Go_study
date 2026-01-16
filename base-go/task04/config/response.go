package config

type Response struct {
	Code    ServiceStatusCode `json:"code"`
	Message string            `json:"messsage"`
	Data    interface{}       `json:"data"`
}

type ServiceStatusCode int

const (
	// DBStatusOK 操作成功：查询/插入/更新/删除执行成功
	DBStatusOK ServiceStatusCode = 200

	// DBStatusBadRequest 参数错误：SQL 语法错误、参数类型不匹配、主键为空
	DBStatusBadRequest ServiceStatusCode = 40001

	// DBStatusNotFound 数据不存在：根据 ID 查询无结果、删除/更新不存在的数据
	DBStatusNotFound ServiceStatusCode = 40401

	// DBStatusConflict 数据冲突：唯一键重复、乐观锁版本冲突、主键重复插入
	DBStatusConflict ServiceStatusCode = 40901

	// DBStatusUnprocessableEntity 数据校验失败：字段长度超限、格式错误（如手机号/邮箱）
	DBStatusUnprocessableEntity ServiceStatusCode = 40002

	// DBStatusInternalError 数据库服务异常：数据库连接失败、服务宕机、权限不足
	DBStatusInternalError ServiceStatusCode = 50001
)
