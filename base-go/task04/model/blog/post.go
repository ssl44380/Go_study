package blog

import (
	"task04/global"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Post struct {
	global.GLOBAL_MODEL
	Title        string `gorm:"not null;size=10;column:title" json:"title"`
	Content      string `gorm:"not null;size=1500;column:content" json:"content"`
	UserID       int
	User         User
	Comment      []Comment `gorm:"foreignKey:PostID;references:ID;constraint:OnDelete:CASCADE"`
	CommentCount uint      `gorm:"not null;default:0;column:comment_count" json:"comment_count" form:"comment_count"`
}

func (p *Post) AfterCreate(tx *gorm.DB) (err error) {
	if p.ID == 0 {
		return nil
	}
	result := tx.Clauses(clause.Locking{
		Strength: "UPDATE",
		Table:    clause.Table{Name: "users"},
	}).Model(&User{}).
		Where("id = ?", p.UserID).
		UpdateColumn("post_count", gorm.Expr("post_count + ?", 1))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}

// func (p *Post) BeforeDelete(tx *gorm.DB) (err error) {
// 	if p.ID == 0 {
// 		return nil
// 	}
// 	var post Post
// 	tx.Model(&User{}).Select("post_count").
// 		Where("id = ?", p.UserID).Find(&post)

// 	if post.CommentCount == 0 {
// 		fmt.Println("无评论")
// 		return errors.New("无评论")
// 	} else {
// 		return nil
// 	}

// }

func (p *Post) AfterDelete(tx *gorm.DB) (err error) {
	if p.ID == 0 {
		return nil
	}
	result := tx.Model(&User{}).
		Where("id = ?", p.UserID).
		UpdateColumn("comment_count", gorm.Expr("comment_count - ?", 1))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}
