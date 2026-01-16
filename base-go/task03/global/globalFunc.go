package global

import (
	"encoding/json"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func InitDB() *gorm.DB {
	dbName := "task_03"
	dsn := fmt.Sprintf("root:su123456@tcp(localhost:3306)/%s?parseTime=True&charset=utf8mb4&loc=Local", dbName)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: false,
	})
	if err != nil {
		log.Fatalf("数据库：%s连接失败：%v\n", dbName, err)
	} else {
		fmt.Printf("数据库：%s练连接成功。\n", dbName)
	}

	return db
}

func SqlxInitDB() *sqlx.DB {
	dbName := "task_03"
	dsn := fmt.Sprintf("root:su123456@tcp(localhost:3306)/%s?parseTime=True&charset=utf8mb4&loc=Local", dbName)
	db, err := sqlx.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("数据库：%s连接失败：%v\n", dbName, err)
	} else {
		fmt.Printf("数据库：%s练连接成功。\n", dbName)
	}

	return db
}

func MigrateTable(db *gorm.DB, dst ...interface{}) {
	if err := db.AutoMigrate(dst...); err != nil {
		log.Fatalf("数据表：%v 迁移失败\n", err)
	} else {
		fmt.Printf("数据表迁移接成功。\n")
	}

}

func CreateDate[T any](db *gorm.DB, datalist []T) {
	if result := db.Clauses(clause.OnConflict{
		DoNothing: true,
	}).Debug().Create(&datalist); result.Error != nil {
		log.Fatalf("创建数据失败：%v\n", result.Error)
	} else {
		fmt.Printf("result.RowsAffected：：：：%v", result.RowsAffected)
		fmt.Printf("数据创建成功。\n")
	}

}

func PrintJson(data interface{}) {
	if jsonResult, err := json.MarshalIndent(data, "", "  "); err != nil {
		fmt.Printf("JSON 序列化失败：%v", err)
	} else {
		fmt.Println(string(jsonResult))

	}

}
