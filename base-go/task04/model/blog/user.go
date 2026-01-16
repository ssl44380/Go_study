package blog

import (
	"errors"
	"task04/global"
	"task04/utils"

	"gorm.io/gorm"
)

type User struct {
	global.GLOBAL_MODEL
	Name      string    `json:"user_name" form:"user_name" gorm:"not null;size:10;required;column:user_name" `
	Email     string    `json:"email" form:"email" gorm:"not null;size:30;email;unique;required;column:email"`
	Password  string    `json:"password" form:"password" gorm:"not null;size:60;required;column:password" `
	Age       uint      `gorm:"not null;default:0;column:age"`
	Post      []Post    `gorm:"foreignKey:UserID;reference:ID;constraint:OnDelete:CASCADE"`
	PostCount uint      `gorm:"not null;default:0;column:post_count"`
	Comment   []Comment `gorm:"foreignKey:UserID;reference:ID;constraint:OnDelete:CASCADE"`
}

// 用户创建前
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	result := tx.First(&User{}, "email = ?", u.Email)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			global.GLOBAL_Logger.Info("该用户不存在，执行创建")
		}
	} else {
		errMsg := "注册失败：用户已存在"
		return errors.New(errMsg)
	}

	if u.Password == "" {
		errMsg := "注册失败：密码不能为空"
		global.GLOBAL_Logger.Error(errMsg)
		return errors.New(errMsg)
	}

	password := utils.Md5Encrypt(u.Password)
	u.Password = password

	return nil
}
