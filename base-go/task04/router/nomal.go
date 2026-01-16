package router

import (
	"task04/service/api"

	"github.com/gin-gonic/gin"
)

func NomalRouter(Router *gin.RouterGroup) {

	normalRouter := Router.Group("user")
	{
		userApi := api.UserApi{}
		normalRouter.POST("/register", userApi.Register) //用户注册
		normalRouter.POST("/login", userApi.Login)       //用户登录  返回一个token
	}

	articleRouter := Router.Group("post")
	{
		postApi := api.PostApi{}

		articleRouter.GET("/list", postApi.GetPostList) //获取文章列表

		articleRouter.GET("/:id/details", postApi.GetPostDetails) // 获取单篇文章信息
	}

	commentRouter := Router.Group("comment")
	{

		commentApi := api.CommentApi{}
		commentRouter.GET("/:postid/getlist", commentApi.GetCommentList) // 获取单篇文章评论列表
	}

}
