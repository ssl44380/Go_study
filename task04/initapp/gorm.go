package initapp

import (
	"task04/config"
	"task04/global"
	"task04/model/blog"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var (
	zapLogger = global.GLOBAL_Logger
)

func InitGorm() *gorm.DB {
	initmysql := config.Mysql{
		Host:     "127.0.0.1",
		Port:     "3306",
		User:     "root",
		Password: "su123456",
		Database: "myblog",
		Config:   "parseTime=True&charset=utf8mb4&loc=Local",
	}

	dsn := initmysql.Dsn()

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: false,
	})
	if err != nil {
		zapLogger.Sugar().Errorf("databases creat filed：%v", err.Error())
	}
	return db
}

func RegisterTables() {
	err := global.GLOBAL_DB.AutoMigrate(
		&blog.User{},
		&blog.Post{},
		&blog.Comment{},
	)

	test_data()
	if err != nil {
		zapLogger.Error(err.Error())
	}

}

func test_data() {

	dataTwo := blog.User{
		Name:     "小李",
		Email:    "xiaoli@qq.com",
		Password: "xiaoli123",
		Post: []blog.Post{
			{
				Title:   "MynameXL",
				Content: "this is interface",
			},
			{
				Title:   "MynameXL2",
				Content: "this is chan",
			},
		},
	}

	dataOne := blog.User{
		Name:     "小明",
		Email:    "xiaoming@qq.com",
		Password: "xiaoming123",
		Post: []blog.Post{
			{
				Title:   "Go Basics",
				Content: "this is interface",
				Comment: []blog.Comment{
					{
						UserID:  1,
						Content: "o   o  my god",
					},
					{
						UserID:  1,
						Content: "o   o  my gesses",
					},
				},
			},
			{
				Title:   "Go Basics2",
				Content: "this is chan",
			},
		},
	}
	global.GLOBAL_DB.Create(&dataTwo)
	global.GLOBAL_DB.Create(&dataOne)
}
