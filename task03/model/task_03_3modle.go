package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type User struct {
	ID        int    `gorm:"not null;unique;primaryKey;autoincrement" `
	Name      string `gorm:"size:32;not unll"`
	Email     string `gorm:"size:32;not unll" `
	Posts     []Post `gorm:"foreignKey:UserID;references:ID"`
	PostCount uint   `gorm:"not unll;default:0"`
}

type Post struct {
	ID    int    `gorm:"not null;unique;primaryKey;autoincrement"`
	Title string `gorm:"size:24;not unll" `
	gorm.Model
	Context      string `gorm:"not null"`
	UserID       int
	User         User      `gorm:"foreignKey:UserID;references:ID"`
	Comments     []Comment `gorm:"foreignKey:PostID;references:ID" `
	CommentCount uint      `gorm:"not unll;default:0"`
}

type Comment struct {
	ID      int    `gorm:"not null;unique;primaryKey;autoincrement" `
	Context string `gorm:"size:300"`
	gorm.Model
	PostID int
	Post   Post `gorm:"foreignKey:PostID;references:ID" `
}

func (p *Post) AfterCreate(tx *gorm.DB) (err error) {
	log.Printf("进入 AfterCreate 钩子：p.ID=%d, tx.RowsAffected=%d", p.ID, tx.RowsAffected)
	if p.ID == 0 {
		return nil // 无关联文章，无需更新
	}

	result := tx.Clauses(clause.Locking{
		Strength: "UPDATE",
		Table:    clause.Table{Name: "users"},
	}).Model(&User{}).
		Where("id = ?", p.UserID).
		UpdateColumn("post_count", gorm.Expr("post_count + ?", 1)) // 原子更新，避免并发问题

	//  校验更新结果
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound // 关联文章不存在，返回错误
	}

	return nil
}

func (p *Comment) AfterCreate(tx *gorm.DB) (err error) {
	if p.ID == 0 {
		return nil // 无关联评论，无需更新
	}
	// 方式1：
	result := tx.Clauses(clause.Locking{
		Strength: "UPDATE",
		Table:    clause.Table{Name: "posts"},
	}).Model(&Post{}).
		Where("id = ?", p.PostID).
		UpdateColumn("comment_count", gorm.Expr("comment_count + ?", 1)) // 原子更新，避免并发问题

	//  校验更新结果
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound // 关联文章不存在，返回错误
	}

	return nil
}

func (c *Comment) AfterDelete(tx *gorm.DB) (err error) {
	if c.ID == 0 {
		return nil // 无关联评论，无需更新
	}
	// 方式1：
	result := tx.Clauses(clause.Locking{
		Strength: "UPDATE",
		Table:    clause.Table{Name: "posts"},
	}).Model(&Post{}).
		Where("id = ?", c.PostID).
		UpdateColumn("comment_count", gorm.Expr("comment_count - ?", 1)) // 原子更新，避免并发问题

	//  校验更新结果
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound // 关联文章不存在，返回错误
	}

	return nil
}

func (c *Comment) BeforeDelete(tx *gorm.DB) (err error) {
	if c.ID == 0 {
		return nil // 无关联文章，无需更新
	}
	var post Post
	tx.Clauses(clause.Locking{
		Strength: "UPDATE",
		Table:    clause.Table{Name: "posts"},
	}).Model(&Post{}).Select("comment_count").
		Where("id = ?", c.PostID).Find(&post)

	if post.CommentCount == 0 {
		fmt.Println("无评论")
		return errors.New("无评论")
	} else {
		return nil
	}

}

type UserPostsComments struct {
	ID    string       `json:"user_id"`
	Name  string       `json:"user_name"`
	Posts []PostSimple `json:"posts"`
}
type PostSimple struct {
	Title    string        `json:"post_title"`
	Context  string        `json:"post_context"`
	Comments []CommentList `json:"commens"`
}
type CommentList struct {
	Context string `json:"comment_context"`
}

func (u *UserPostsComments) FromUser(user User) {
	u.ID = fmt.Sprintf("%d", user.ID)
	u.Name = user.Name
	for _, post := range user.Posts {
		postSimple := PostSimple{
			Title:   post.Title,
			Context: post.Context,
		}
		for _, comment := range post.Comments {
			postSimple.Comments = append(postSimple.Comments, CommentList{
				Context: comment.Context,
			})
		}
		u.Posts = append(u.Posts, postSimple)
	}
}

func (u UserPostsComments) MarshalJSON() ([]byte, error) {
	type TempUser struct {
		ID    string       `json:"user_id"`
		Name  string       `json:"user_name"`
		Posts []PostSimple `json:"posts"`
	}
	return json.Marshal(TempUser{
		ID:    u.ID,
		Name:  u.Name,
		Posts: u.Posts,
	})
}

type CommentInfo struct {
	Context string
}
type QueryMaxCommentPost struct {
	Name         string
	Title        string
	Context      string
	CountComment int
	Comments     []CommentInfo
}

func (p *QueryMaxCommentPost) FromPost(post Post) {
	p.Comments = []CommentInfo{}

	p.Name = post.User.Name
	p.CountComment = len(post.Comments)
	p.Title = post.Title
	p.Context = post.Context

	for _, c := range post.Comments {
		p.Comments = append(p.Comments, CommentInfo{
			Context: c.Context,
		})
	}

}
