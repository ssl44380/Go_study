package blog

import (
	"task04/global"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Comment struct {
	global.GLOBAL_MODEL
	Content string `gorm:"not null;size=150; "  json:"content"  `
	PostID  uint   `gorm:"column:post_id;not null" json:"post_id"`
	UserID  uint   `gorm:"column:user_id;not null" json:"user_id"`
	User    User   `gorm:"foreignKey:UserID" json:"-"`
	Post    Post   `gorm:"foreignKey:PostID;references:ID;constraint:OnDelete:CASCADE"`
	// 父评论id外键，指向自身
	ParentID *uint `gorm:"index;comment:父评论ID（NULL表示根评论）"`
	// 子评论当前外键是自己的ParentID，指向父评论的ID（一对多关系）
	Children []Comment `gorm:"foreignKey:ParentID;references:ID;constraint:OnDelete:CASCADE"`
	// 当前评论所属的父评论（多对一关系）
	Parent *Comment `gorm:"foreignKey:ParentID;references:ID;constraint:OnDelete:CASCADE"`
}

func (c *Comment) AfterCreate(tx *gorm.DB) (err error) {
	if c.ID == 0 {
		return nil
	}
	result := tx.Clauses(clause.Locking{
		Strength: "UPDATE",
		Table:    clause.Table{Name: "posts"},
	}).Model(&Post{}).
		Where("id = ?", c.PostID).
		UpdateColumn("comment_count", gorm.Expr("comment_count + ?", 1))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}

// func (c *Comment) BeforeDelete(tx *gorm.DB) (err error) {
// 	if c.ID == 0 {
// 		return nil
// 	}
// 	var post Post
// 	tx.Model(&Post{}).Select("comment_count").
// 		Where("id = ?", c.PostID).Find(&post)

// 	if post.CommentCount == 0 {
// 		fmt.Println("无评论")
// 		return errors.New("无评论")
// 	} else {
// 		return nil
// 	}

// }

func (c *Comment) AfterDelete(tx *gorm.DB) (err error) {
	if c.ID == 0 {
		return nil
	}
	result := tx.Model(&Post{}).
		Where("id = ?", c.PostID).
		UpdateColumn("comment_count", gorm.Expr("comment_count - ?", 1))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}

// func getReplies(db *gorm.DB, commentID uint) []Comment {
// 	var replies []Comment
// 	db.Where("parent_id = ?", commentID).Find(&replies)
// 	for i := range replies {
// 		replies[i].Children = getReplies(db, replies[i].ID) // 递归查询子回复
// 	}
// 	return replies
// }
