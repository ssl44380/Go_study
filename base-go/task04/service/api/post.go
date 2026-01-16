package api

import (
	"errors"
	"strconv"
	"task04/common/response"
	"task04/dto"
	"task04/global"
	"task04/model/blog"
	"task04/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PostApi struct{}

var ll = global.GLOBAL_Logger

func (u *PostApi) CreatePost(c *gin.Context) {

	// 1.从上下文获取请求id
	userID, exists := c.Get("user_id")

	if !exists {
		global.GLOBAL_Logger.Error("未获取到用户信息")
		response.FailDBStatusBadRequest("未获取到用户信息", c)
		return
	}

	// userID, exists := c.Get("user_id")

	uid, _ := utils.AnyToUint(userID)

	// 2.绑定请求参数
	var postcreateDto dto.PostCreateDto
	if err := c.ShouldBind(&postcreateDto); err != nil {
		global.GLOBAL_Logger.Error("参数错误")
		response.FailDBStatusBadRequest("参数错误", c)
		return
	}

	// 3.创建文章（关联用户id）
	post := blog.Post{
		Title:   postcreateDto.Title,
		Content: postcreateDto.Content,
		UserID:  int(uid),
	}

	if err := global.GLOBAL_DB.Create(&post).Error; err != nil {
		global.GLOBAL_Logger.Error("创建失败：" + err.Error())
		response.FailDBStatusBadRequest("创建失败："+err.Error(), c)
		return
	}
	global.GLOBAL_Logger.Info("创建成功")
	response.SuccessDBStatusWithInfoOK("创建成功", post, c)

}

func (u *PostApi) UpdatePost(c *gin.Context) {

	// 1.从上下文获取请求id
	userID, exists := c.Get("user_id")
	if !exists {
		global.GLOBAL_Logger.Error("未获取到用户信息")
		response.FailDBStatusBadRequest("未获取到用户信息", c)
		return
	}

	uid, _ := utils.AnyToUint(userID)

	// 2.绑定请求参数
	var postupdateDto dto.PostUpdateDto
	if err := c.ShouldBind(&postupdateDto); err != nil {
		global.GLOBAL_Logger.Error("参数错误")
		response.FailDBStatusBadRequest("参数错误", c)
		return
	}

	// 3.更新文章（关联用户id）
	post_id, _ := strconv.Atoi(c.Param("id"))
	postupdate := blog.Post{
		Title:   postupdateDto.Title,
		Content: postupdateDto.Content,
	}

	returndata := map[string]interface{}{
		"title":   postupdate.Title,
		"content": postupdate.Content,
		"post_id": post_id,
	}
	// 4.判断是否可以更新文章
	var postdest blog.Post
	if err := global.GLOBAL_DB.First(&postdest, post_id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			global.GLOBAL_Logger.Error("该文章不存在：" + err.Error())
			response.FailDBStatusBadRequest("该文章不存在："+err.Error(), c)
			return
		}
		return
	}

	if uint(post_id) != postdest.ID && uid != uint(postdest.UserID) {
		global.GLOBAL_Logger.Error("无权限更新")
		response.FailDBStatusBadRequest("无权限更新", c)
		return
	}

	if err := global.GLOBAL_DB.Model(&blog.Post{}).Where("id = ?", post_id).Updates(&postupdate).Error; err != nil {
		global.GLOBAL_Logger.Error("更新失败：" + err.Error())
		response.FailDBStatusBadRequest("更新失败："+err.Error(), c)
		return
	}
	global.GLOBAL_Logger.Info("更新成功")
	response.SuccessDBStatusWithInfoOK("更新成功", returndata, c)

}

func (u *PostApi) DeletePost(c *gin.Context) {

	// 1.从上下文获取请求id
	userID, exists := c.Get("user_id")
	if !exists {
		global.GLOBAL_Logger.Error("未获取到用户信息")
		response.FailDBStatusBadRequest("未获取到用户信息", c)
		return
	}

	uid, _ := utils.AnyToUint(userID)

	// 2.绑定请求参数
	post_id, _ := strconv.Atoi(c.Param("id"))

	// 3.判断是否可以删除文章
	var postdest blog.Post
	if err := global.GLOBAL_DB.First(&postdest, post_id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			global.GLOBAL_Logger.Error("该文章不存在：" + err.Error())
			response.FailDBStatusBadRequest("该文章不存在："+err.Error(), c)
			return
		}
		return
	}

	if uint(post_id) != postdest.ID && uid != uint(postdest.UserID) {
		global.GLOBAL_Logger.Error("无权限删除")
		response.FailDBStatusBadRequest("无权限删除", c)
		return
	}

	// 配置外键级联删除时，只有物理删除才会触发级联删除
	// 所以使用软删除时，除了删除文章还要删除文章对应的评论
	// 这里我们先删除评论(当被删除文章评论数量不为零时执行)，再删除文章
	if postdest.CommentCount != 0 {
		if err := global.GLOBAL_DB.Where("post_id = ?", post_id).Delete(&blog.Comment{}).Error; err != nil {
			global.GLOBAL_Logger.Error("删除该对应评论失败：" + err.Error())
			response.FailDBStatusBadRequest("删除该对应评论失败："+err.Error(), c)
			return
		}
	}
	if err := global.GLOBAL_DB.Where("id = ?", post_id).Delete(&blog.Post{}).Error; err != nil {
		global.GLOBAL_Logger.Error("删除该文章失败：" + err.Error())
		response.FailDBStatusBadRequest("删除该文章失败："+err.Error(), c)
		return
	}
	global.GLOBAL_Logger.Error("删除成功")
	response.SuccessDBStatusOK("删除成功", c)

}

func (u *PostApi) GetPostDetails(c *gin.Context) {
	var post blog.Post

	postId := c.Param("id")

	if err := global.GLOBAL_DB.Debug().
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "user_name")
		}).
		Preload("Comment", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC")
		}).Preload("Comment.User").
		Select("id", "title", "content", "user_id", "created_at", "comment_count").
		First(&post, postId).Error; err != nil {

		response.FailDBStatusBadRequest("查询失败："+err.Error(), c)
	} else {
		postDetailDto := dto.PostDto{
			ID:           post.ID,
			UserName:     post.User.Name, // 从预加载的User中取用户名
			Title:        post.Title,
			Content:      post.Content,
			CreatedAt:    post.CreatedAt,
			CommentCount: post.CommentCount,
		}
		for _, comment := range post.Comment {
			postDetailDto.Comments = append(postDetailDto.Comments, dto.CommentDTO{
				UserID:    comment.User.ID,
				UserName:  comment.User.Name,
				Content:   comment.Content,
				CreatedAt: comment.CreatedAt,
			})
		}
		global.GLOBAL_Logger.Info("查询成功")
		response.SuccessDBStatusWithInfoOK("查询成功", postDetailDto, c)
	}

}

func (u *PostApi) GetPostList(c *gin.Context) {

	var postDto []dto.PostDto

	if err := global.GLOBAL_DB.Debug().
		Model(&blog.Post{}).
		Joins("LEFT JOIN users ON posts.user_id = users.id").
		Select("posts.id", "posts.title", "posts.content", "posts.created_at", "users.user_name").
		Scan(&postDto).Error; err != nil {
		// DBStatusConflict 创建失败的返回值
		global.GLOBAL_Logger.Error("查询失败：" + err.Error())
		response.FailDBStatusBadRequest("查询失败："+err.Error(), c)
	} else {
		global.GLOBAL_Logger.Info("查询成功")
		response.SuccessDBStatusWithInfoOK("查询成功", postDto, c)
	}

}
