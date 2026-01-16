package request

// type PageInfo struct {
// 	Offest  int    `json:"offest" form:"offest"`
// 	Limit   int    `json:"limit" form:"limit"`
// 	KeyWord string `json:"keyword" form:"keyword"`
// }

// func (p PageInfo) GetPostByKeyword() {
// 	var getPostList blog.Post
// 	var rawUser model.User
// 	var customUser model.UserPostsComments
// 	db.Model(&model.User{}).Select("id", "name").Where("name = ?", "李四").
// 		Preload("Posts", func(db *gorm.DB) *gorm.DB {
// 			return db.Select("id", "title", "content", "user_id")
// 		}).Preload("Posts.Comments", func(db *gorm.DB) *gorm.DB {
// 		return db.Select("content", "post_id")
// 	}).First(&rawUser)
// 	customUser.FromUser(rawUser)
// }

// func (u *UserApi) Register(c *gin.Context) {

// 	var userRegister blog.User
// 	err := c.ShouldBind(&userRegister)
// 	if err != nil {
// 		// 这里应该用网络获取参数的错误，暂时用db错误参数
// 		response.FailDBStatusInternalError("", c)
// 	}

// 	result := global.GLOBAL_DB.Create(&userRegister)
// 	if result.Error != nil {
// 		// DBStatusConflict 创建失败的返回值
// 		l.Error("注册失败："+result.Error.Error())
// 		response.FailDBStatusBadRequest("注册失败："+result.Error.Error(), c)
// 	} else {
// 		response.SuccessDBStatusOK("注册成功", c)
// 	}

// }
