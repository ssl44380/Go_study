package dto

import (
	"time"
)

type PostDto struct {
	UserName     string       `json:"user_name" form:"user_name"`
	ID           uint         `json:"id" form:"id"`
	Title        string       `json:"title" form:"title"`
	Content      string       `json:"content" form:"content"`
	CreatedAt    time.Time    `json:"created_at" form:"created_at"`
	Comments     []CommentDTO `json:"comment_list,omitempty" form:"comment_list" gorm:"-" `
	CommentCount uint         `json:"comment_count" form:"comment_count"`
}

type PostCreateDto struct {
	Title   string `json:"title" form:"title"`
	Content string `json:"content" form:"content"`
	UserID  uint   `json:"user_id" form:"user_id"`
}

type PostUpdateDto struct {
	Title   string `json:"title" form:"title"`
	Content string `json:"content" form:"content"`
	UserID  uint   `json:"user_id" form:"user_id"`
}
