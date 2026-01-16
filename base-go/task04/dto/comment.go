package dto

import "time"

type CommentDTO struct {
	ID        uint      `json:"id,omitempty"`
	UserID    uint      `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UserName  string    `json:"user_name"` // 评论者用户名
	Content   string    `json:"content" form:"content"`
}
