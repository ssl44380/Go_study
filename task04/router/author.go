package router

import (
	middleware "task04/moddlewrea"
	"task04/service/api"

	"github.com/gin-gonic/gin"
)

func AuthorRouter(Router *gin.RouterGroup) {

	articleRouter := Router.Group("api")
	articleRouter.Use(middleware.JWTMiddleware())
	{

		postApi := api.PostApi{}
		postRouter := articleRouter.Group("/post")

		postRouter.POST("/create", postApi.CreatePost) //创建文章

		postRouter.POST("/:id/update", postApi.UpdatePost) // 更新文章

		postRouter.POST("/:id/delete", postApi.DeletePost) // 删除文章

	}

	{
		commentApi := api.CommentApi{}

		commentRouter := articleRouter.Group("/comment")

		commentRouter.POST("/:postid/create", commentApi.CreateComment) // 创建评论
	}

}
