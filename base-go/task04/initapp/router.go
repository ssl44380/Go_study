package initapp

import (
	"task04/router"

	"github.com/gin-gonic/gin"
)

func Router() {

	// 生成路由句柄
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	nrg := r.Group("/")
	router.NomalRouter(nrg)
	router.AuthorRouter(nrg)
	// 普通浏览路由

	r.Run(":8080")

}
