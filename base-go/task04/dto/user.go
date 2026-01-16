package dto

type UserDto struct {
	ID       uint   `json:"id" form:"id"`
	UserName string `json:"user_name" form:"user_name"`
	Email    string `json:"email" form:"email" `
}
