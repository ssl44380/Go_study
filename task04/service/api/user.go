package api

import (
	"errors"
	"task04/common/response"
	"task04/global"
	"task04/model/blog"
	"task04/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UserApi struct{}

func (u *UserApi) Register(c *gin.Context) {

	var userRegister blog.User
	err := c.ShouldBind(&userRegister)
	if err != nil {
		// 这里应该用网络获取参数的错误，暂时用db错误参数
		response.FailDBStatusInternalError("", c)
	}

	result := global.GLOBAL_DB.First(&userRegister, "email = ?", userRegister.Email)
	if result.Error == nil {
		global.GLOBAL_Logger.Error("注册失败：用户已注册 ")
		response.FailDBStatusBadRequest("注册失败：用户已注册 ", c)
	}

	resultCreate := global.GLOBAL_DB.Create(&userRegister)
	if resultCreate.Error != nil {
		// DBStatusConflict 创建失败的返回值
		global.GLOBAL_Logger.Error("注册失败：" + result.Error.Error())
		response.FailDBStatusBadRequest("注册失败："+result.Error.Error(), c)
	} else {
		global.GLOBAL_Logger.Info("注册成功")
		response.SuccessDBStatusOK("注册成功", c)
	}

}

func (u *UserApi) Login(c *gin.Context) {

	var userLogin blog.User
	err := c.ShouldBind(&userLogin)
	if err != nil {
		// 这里应该用网络获取参数的错误，暂时用db错误参数
		response.FailDBStatusInternalError("", c)
	}

	var userFirst blog.User

	result := global.GLOBAL_DB.First(&userFirst, "email = ?", userLogin.Email)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			global.GLOBAL_Logger.Error("登录失败：用户未注册 " + result.Error.Error())
			response.FailDBStatusBadRequest("登录失败：用户未注册 "+result.Error.Error(), c)
		} else {
			global.GLOBAL_Logger.Error("登录失败 " + result.Error.Error())
			response.FailDBStatusBadRequest("登录失败 "+result.Error.Error(), c)
		}
	} else {
		p := utils.Md5Encrypt(userLogin.Password)
		targetP := userFirst.Password
		if p == targetP {
			token, _ := utils.GenerateToken(userFirst.ID)

			msg := map[string]interface{}{
				"access_token": token,
			}

			// 执行登录
			global.GLOBAL_Logger.Info("登录失败：密码输入错误")
			response.SuccessDBStatusWithInfoOK("登录成功", msg, c)

		} else {
			global.GLOBAL_Logger.Error("登录失败：密码输入错误")
			response.FailDBStatusBadRequest("登录失败：密码输入错误", c)
		}
	}

}
