package api

import (
	"fmt"
	"strconv"
	"task04/common/response"
	"task04/dto"
	"task04/global"
	"task04/model/blog"
	"task04/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CommentApi struct{}

var lc = global.GLOBAL_Logger

func (u *CommentApi) GetCommentList(c *gin.Context) {

	var commentList []blog.Comment

	var commentDtoList []dto.CommentDTO

	postId := c.Param("postid")

	if err := global.GLOBAL_DB.Debug().
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "user_name")
		}).Where("post_id = (?)", postId).
		Select("id", "content", "user_id", "created_at").
		Find(&commentList).Error; err != nil {
		global.GLOBAL_Logger.Error("查询失败：" + err.Error())
		response.FailDBStatusBadRequest("查询失败："+err.Error(), c)
	} else {
		for _, comment := range commentList {
			commenDTO := dto.CommentDTO{
				ID:        comment.ID,
				UserID:    comment.UserID,
				UserName:  comment.User.Name, // 从预加载的User中取用户名
				CreatedAt: comment.CreatedAt,
				Content:   comment.Content,
			}

			commentDtoList = append(commentDtoList, commenDTO)

		}
		global.GLOBAL_Logger.Info("查询成功")
		response.SuccessDBStatusWithInfoOK("查询成功", commentDtoList, c)

	}
}

func (u *CommentApi) CreateComment(c *gin.Context) {

	// 1.从上下文获取请求id
	userID, exists := c.Get("user_id")

	if !exists {
		global.GLOBAL_Logger.Error("未获取到用户信息")
		response.FailDBStatusBadRequest("未获取到用户信息", c)
		return
	}

	// userID, exists := c.Get("user_id")

	uid, _ := utils.AnyToUint(userID)
	post_id, _ := strconv.Atoi(c.Param("postid"))
	fmt.Print(uid, post_id)
	// 2.绑定请求参数
	var commentcreateDto dto.CommentDTO
	if err := c.ShouldBind(&commentcreateDto); err != nil {
		global.GLOBAL_Logger.Error("参数错误" + err.Error())
		response.FailDBStatusBadRequest("参数错误", c)
		return
	}

	// 3.创建文章（关联用户id）
	comment := blog.Comment{
		Content: commentcreateDto.Content,
		UserID:  uid,
		PostID:  uint(post_id),
	}

	if err := global.GLOBAL_DB.Debug().Create(&comment).Error; err != nil {
		global.GLOBAL_Logger.Error("创建失败：" + err.Error())
		response.FailDBStatusBadRequest("创建失败："+err.Error(), c)
		return
	}
	global.GLOBAL_Logger.Info("创建成功")
	response.SuccessDBStatusWithInfoOK("创建成功", comment, c)

}
