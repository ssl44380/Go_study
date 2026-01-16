package main

import (
	"fmt"
	"log"
	"task03/global"
	globalFunc "task03/global"
	model "task03/model"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/jmoiron/sqlx"
	"gorm.io/gorm"
)

/*
假设有一个名为 students 的表，包含字段 id （主键，自增）、 name （学生姓名，字符串类型）、
age （学生年龄，整数类型）、 grade （学生年级，字符串类型）。
要求 ：
编写SQL语句向 students 表中插入一条新记录，学生姓名为 "张三"，年龄为 20，年级为 "三年级"。
编写SQL语句查询 students 表中所有年龄大于 18 岁的学生信息。
编写SQL语句将 students 表中姓名为 "张三" 的学生年级更新为 "四年级"。
编写SQL语句删除 students 表中年龄小于 15 岁的学生记录。
*/

func task_03_1_1(db *gorm.DB) {
	globalFunc.MigrateTable(db, &model.Student{})
	var studentList = []model.Student{
		{ID: 1, Name: "李四", Age: 20, Grade: 3},
		{ID: 2, Name: "王五", Age: 15, Grade: 3},
		{ID: 3, Name: "肖六", Age: 14, Grade: 2},
		{ID: 4, Name: "熊大", Age: 18, Grade: 1},
		{ID: 5, Name: "熊二", Age: 17, Grade: 1},
	}
	// fmt.Printf("%T", studentList)
	global.CreateDate(db, studentList)
	// 向 students 表中插入一条新记录，学生姓名为 "张三"，年龄为 20，年级为 "三年级"。
	// 查询数据表中有没有张三信息，如果没有则创建
	// var queryZS mode.Student
	queryZSresult := db.First(&model.Student{}, "name = ? and age=? and grade=?", "张三", 20, 3)
	if queryZSresult.RowsAffected == 0 {
		db.Debug().Create(&model.Student{ID: 6, Name: "张三", Age: 20, Grade: 3})
	}
	// 查询 students 表中所有年龄大于 18 岁的学生信息
	var age18 []model.Student
	datalist := db.Debug().Where("age > ?", 18).Find(&age18)

	if datalist.Error != nil {
		fmt.Printf("查询报错：%v", datalist.Error)
	} else {
		global.PrintJson(age18)
	}

	// 将 students 表中姓名为 "张三" 的学生年级更新为 "四年级"。
	var zsInfo model.Student
	db.Debug().Select("grade").Where("name = ?", "张三").First(&zsInfo)
	fmt.Printf("张三年级更改前：%v", zsInfo.Grade)
	db.Debug().Model(&zsInfo).Where("name = ?", "张三").Update("grade", 4)
	db.Debug().Select("grade").Where("name = ?", "张三").First(&zsInfo)
	fmt.Printf("张三年级更改后：%v", zsInfo.Grade)
	// 删除 students 表中年龄小于 15 岁的学生记录。
	var deleteAge15 []model.Student
	db.Debug().Where("age < ?", 15).Find(&deleteAge15)
	if len(deleteAge15) != 0 {
		fmt.Printf("这是删除前查到的记录：\n")
		global.PrintJson(deleteAge15)
		for _, v := range deleteAge15 {
			db.Delete(&model.Student{}, v.ID)
		}
	}
	db.Debug().Where("age < ?", 15).Find(&deleteAge15)
	fmt.Printf("这是删除后查到的记录条数：%d\n", len(deleteAge15))
	// 清空表
	db.Migrator().DropTable(&model.Student{})
}

/*
假设有两个表： accounts 表（包含字段 id 主键， balance 账户余额）
和 transactions 表（包含字段 id 主键， from_account_id 转出账户ID， to_account_id 转入账户ID， amount 转账金额）。
要求 ：
编写一个事务，实现从账户 A 向账户 B 转账 100 元的操作。
在事务中，需要先检查账户 A 的余额是否足够，
如果足够则从账户 A 扣除 100 元，向账户 B 增加 100 元，并在 transactions 表中记录该笔转账信息。如果余额不足，则回滚事务。
*/

func task_03_1_2(db *gorm.DB) {
	global.MigrateTable(db, &model.Account{}, &model.Transcation{})
	fromAccountID := "A"
	toAccountID := "B"
	amount := 100.00
	// 创建用户A和用户B
	accountsList := []model.Account{
		{ID: fromAccountID, Balance: 500.00},
		{ID: toAccountID, Balance: 0.00},
	}
	global.CreateDate(db, accountsList)
	var transactionBefore []model.Account
	db.Debug().Or("ID = ?", fromAccountID).Or("ID = ?", toAccountID).Find(&transactionBefore)
	fmt.Println("转账前账户信息：")
	for _, v := range transactionBefore {

		fmt.Printf("账户ID：%s,账户余额：%2.f\n", v.ID, v.Balance)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		var queyrABalance model.Account
		tx.Debug().Where("ID =? and Balance >= ?", fromAccountID, amount).First(&queyrABalance)
		if queyrABalance.Balance < amount {
			return fmt.Errorf("账户A余额不足")
		} else {
			err := tx.Debug().Model(&model.Account{}).Where("id = ?", fromAccountID).Update("balance", gorm.Expr("balance - ?", amount))
			if err.Error != nil {
				return fmt.Errorf("账户A扣款失败：%w", err.Error)
			}
			err1 := tx.Debug().Model(&model.Account{}).Where("id = ?", toAccountID).Update("balance", gorm.Expr("balance + ?", amount))
			if err1.Error != nil {
				return fmt.Errorf("账户B收款失败：%w", err1.Error)
			}
			err2 := tx.Debug().Create(&model.Transcation{
				From_Account_ID: fromAccountID, To_Account_ID: toAccountID, Amount: amount,
			})
			if err2.Error != nil {
				return fmt.Errorf("向交易信息列表添加交易信息失败：%w", err2.Error)
			}

		}
		var transactionAfter []model.Account
		db.Debug().Or("ID = ?", fromAccountID).Or("ID = ?", toAccountID).Find(&transactionAfter)
		fmt.Println("转账后账户信息：")
		for _, v := range transactionBefore {

			fmt.Printf("账户ID：%s,账户余额：%2.f\n", v.ID, v.Balance)
		}
		return nil

	})
	if err != nil {
		fmt.Printf("事务执行失败：%v\n", err)
	} else {
		fmt.Println("事务执行成功")
	}
	// db.Migrator().DropTable(&model.Account{}, &model.Transcation{})

}

/*
题目1：使用SQL扩展库进行查询
假设你已经使用Sqlx连接到一个数据库，并且有一个 employees 表，包含字段 id 、 name 、 department 、 salary 。
要求 ：
编写Go代码，使用Sqlx查询 employees 表中所有部门为 "技术部" 的员工信息，并将结果映射到一个自定义的 Employee 结构体切片中。
编写Go代码，使用Sqlx查询 employees 表中工资最高的员工信息，并将结果映射到一个 Employee 结构体中。
*/

func task_03_2_1(sql *sqlx.DB) {
	defer sql.Close()

	_, err := sql.Exec(`
	CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    department ENUM('技术部', '财务部', '销售部','人事部') NOT NULL,
	salary DECIMAL(10, 2) NOT NULL 	DEFAULT 0.00
	);`)
	if err != nil {
		panic(fmt.Sprintf("数据库连接失败：%v", err))
	}
	// sqlBatch := "INSERT INTO employees (name, department, salary) VALUES (?, ?, ?),(?, ?, ?),(?, ?, ?),(?, ?, ?),(?, ?, ?)"
	// params := []interface{}{
	// 	"李四", "销售部", 15200.00,
	// 	"王五", "技术部", 12800.00,
	// 	"赵六", "财务部", 14500.00,
	// 	"孙七", "技术部", 21000.00,
	// 	"周八", "人事部", 16800.00,
	// }
	// if _, err = sql.Exec(sqlBatch, params...); err != nil {
	// 	fmt.Printf("批量插入失败：%v\n", err)
	// 	return
	// } else {
	// 	fmt.Println("批量插入成功")
	// }

	// 查询 employees 表中所有部门为 "技术部" 的员工信息，并将结果映射到一个自定义的 Employee 结构体切片中。
	var techEmps []model.Employee
	sqlStr := "select name,department,salary from employees where department = ? "
	err = sql.Select(&techEmps, sqlStr, "技术部")
	if err != nil {
		fmt.Printf("未查询到技术部员工：%v", err)
		return
	} else {
		fmt.Println("查询到的所有技术部员工信息：")
		for _, v := range techEmps {
			fmt.Printf("员工姓名：%s，员工部门：%s，员工薪资：%.2f\n", v.Name, v.Department, v.Salary)
		}
	}

	//查询 employees 表中工资最高的员工信息，并将结果映射到一个 Employee 结构体中。
	var maxSalary model.Employee
	sqlSalaryMax := "select name,department,salary from employees order by ? desc limit 1 "
	err = sql.Get(&maxSalary, sqlSalaryMax, "salary")
	if err != nil {
		fmt.Printf("未查询到薪资最高的员工：%v", err)
		return
	} else {
		fmt.Println("薪资最高的员工信息：")
		fmt.Printf("姓名：%s，部门：%s，薪资：%.2f\n", maxSalary.Name, maxSalary.Department, maxSalary.Salary)
	}

}

/*
假设有一个 books 表，包含字段 id 、 title 、 author 、 price 。
要求 ：
定义一个 Book 结构体，包含与 books 表对应的字段。
编写Go代码，使用Sqlx执行一个复杂的查询，例如查询价格大于 50 元的书籍，并将结果映射到 Book 结构体切片中，确保类型安全。

前置执行
-- 创建books表
CREATE TABLE books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

-- 插入数据
INSERT INTO books (title, author, price) VALUES
('Python编程', 'John Doe', 39.99),
('数据结构与算法', 'Jane Smith', 59.99),
('机器学习基础', 'Alice Johnson', 69.99),
('go编程', 'Jane Smith', 59.99);


*/

func task_03_2_2(sql *sqlx.DB) {
	var price50 []model.Book
	price50str := "select * from books where price > ?"
	err := sql.Select(&price50, price50str, 50)
	if err != nil {
		log.Fatalf("查询报错：%v", err)
	} else {
		fmt.Println("价格大于 50 元的书籍：")
		for _, v := range price50 {
			fmt.Printf("ID号：%d，书名：%s，作者：%s，价格：%.2f\n", v.ID, v.Title, v.Author, v.Price)
		}
	}
	defer sql.Close()

}

/*
题目1：模型定义
假设你要开发一个博客系统，有以下几个实体： User （用户）、 Post （文章）、 Comment （评论）。
要求 ：
使用Gorm定义 User 、 Post 和 Comment 模型，其中 User 与 Post 是一对多关系（一个用户可以发布多篇文章），
Post 与 Comment 也是一对多关系（一篇文章可以有多个评论）。
编写Go代码，使用Gorm创建这些模型对应的数据库表。
*/
func task_03_3_1(db *gorm.DB) {
	globalFunc.MigrateTable(db, &model.User{}, &model.Post{}, &model.Comment{})
	var usersList = []model.User{
		{ID: 1, Name: "张三", Email: "zhangsan@qq.com"},
		{ID: 2, Name: "李四", Email: "lisi@qq.com"},
		{ID: 3, Name: "王五", Email: "wangwu@qq.com"},
	}
	global.CreateDate(db, usersList)
	var postList = []model.Post{
		{ID: 1, Title: "张三go 学习笔记", Content: "我是张三，go这个语言太难了..........", UserID: 1},
		{ID: 2, Title: "张三python 学习笔记", Content: "我是张三，python这个语言太简单了..........", UserID: 1},
		{ID: 3, Title: "李四go 学习笔记", Content: "我是李四，张三说的对，go这个语言太难了..........", UserID: 2},
		{ID: 4, Title: "李四python 学习笔记", Content: "我是李四，张三说的对，python这个语言太简单了..........", UserID: 2},
		{ID: 5, Title: "王五go 学习笔记", Content: "我是王五，他们说的都不对，go这个语言太简单了..........", UserID: 3},
		{ID: 6, Title: "王五python 学习笔记", Content: "我是李四，他们说的都不对，python这个语言才是真的难..........", UserID: 3},
	}
	global.CreateDate(db, postList)
	var commentList = []model.Comment{
		{ID: 1, Content: "这个作者说的对。", PostID: 1},
		{ID: 7, Content: "乱七八糟。", PostID: 1},
		{ID: 2, Content: "没有比python更简单的语言了", PostID: 2},
		{ID: 8, Content: "没有一点价值", PostID: 2},
		{ID: 3, Content: "你真的是在胡说八道", PostID: 3},
		{ID: 4, Content: "可以求一个教程吗", PostID: 4},
		{ID: 9, Content: "有一份教程吗？", PostID: 3},
		{ID: 5, Content: "一看作者就是大佬", PostID: 5},
		{ID: 10, Content: "我并不赞同这个说法", PostID: 5},
		{ID: 6, Content: "小白到底应该怎么学", PostID: 6},
	}
	global.CreateDate(db, commentList)
	db.Create(&model.User{ID: 4, Name: "肖七", Email: "xiaoqi@qq.com", Posts: []model.Post{
		{Title: "厨艺大全", Content: "番茄炒鸡蛋的做法是......"},
		{Title: "厨艺大全2", Content: "升级版番茄炒鸡蛋的做法是......"},
	}})
	var user1 = model.User{ID: 5, Name: "陈九", Email: "chenjiu@qq.com"}
	db.Create(&user1)
	post1 := model.Post{ID: 9, Title: "酿酒大全", Content: "桂花酒的制作工艺为......"}
	db.Model(&user1).Association("Posts").Append(&post1)
}

/*
题目2：关联查询
基于上述博客系统的模型定义。
要求 ：
编写Go代码，使用Gorm查询某个用户发布的所有文章及其对应的评论信息。
编写Go代码，使用Gorm查询评论数量最多的文章信息。
*/

func task_03_3_2(db *gorm.DB) {
	/*
		通过查询关联模型计数也可以完成这两道题
		var pos model.Post
		db.First(&pos, 1)
		aa := db.Model(&pos).Association("Comments").Count()
		fmt.Println("==========", aa)
	*/

	// 使用Gorm查询某个用户发布的所有文章及其对应的评论信息。
	var rawUser model.User
	var customUser model.UserPostsComments
	db.Model(&model.User{}).Select("id", "name").Where("name = ?", "李四").
		Preload("Posts", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "title", "content", "user_id")
		}).Preload("Posts.Comments", func(db *gorm.DB) *gorm.DB {
		return db.Select("content", "post_id")
	}).First(&rawUser)
	customUser.FromUser(rawUser)
	global.PrintJson(customUser)

	// 使用Gorm查询评论数量最多的文章信息。
	var rawPost []model.Post
	var customMaxCommentPost model.QueryMaxCommentPost
	// // 定义一个postID列表
	var postIDs []int
	// // 按post_id分组统计各个文章都有多少评论
	countComment := db.Model(&model.Comment{}).Select("post_id", "count(*) as count").Group("post_id")
	// // 找出评论最的数
	maxCountComment := db.Table("(?) as temp ", countComment).Select("MAX(count)")
	// // 通过最大评论数获得，评论最多的文章id，并将这些id记入postID列表中
	db.Debug().Model(&model.Comment{}).Select("post_id").
		Group("post_id").
		Having("count(*)= (?)", maxCountComment).Scan(&postIDs)
	// 通过postID列表中记录的ID查文章信息，preload关联查询一定要在查询条件中写关联字段
	db.Model(&model.Post{}).Select("id", "Title", "content", "user_id").
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id ,name")
		}).Preload("Comments", func(db *gorm.DB) *gorm.DB {
		return db.Select("content,post_id")
	}).Where("ID in (?)", postIDs).
		Find(&rawPost)
	for _, v := range rawPost {
		customMaxCommentPost.FromPost(v)
		global.PrintJson(customMaxCommentPost)
	}
}

/*
题目3：钩子函数
继续使用博客系统的模型。
要求 ：
为 Post 模型添加一个钩子函数，在文章创建时自动更新用户的文章数量统计字段。
为 Comment 模型添加一个钩子函数，在评论删除时检查文章的评论数量，如果评论数量为 0，则更新文章的评论状态为 "无评论"。
*/

func task_03_3_3(db *gorm.DB) {

	var user1 model.User
	db.First(&user1, 1)
	// a := db.Model(&user1).Association("Posts").Count()
	// fmt.Println(a)

	// var posts []model.Post
	// db.Model(&user1).Association("Posts").Find(&posts)
	// fmt.Println(posts)

	// global.CreateDate(db, postList)

	// 通过评论ID找到要删除的评论文章ID
	var comment1 *model.Comment
	db.First(&comment1, 6)
	if comment1.PostID == 0 {
		log.Fatalf("该评论不存在（评论ID：%d）。", comment1.ID)
	} else {
		// 获取删除评论前，对应文章评论数量
		var beforePostComment model.Post
		db.Debug().Where("id = ?", comment1.PostID).Take(&beforePostComment)
		fmt.Printf("执行删除前：文章ID：%d，文章评论数：%d\n", beforePostComment.ID, beforePostComment.CommentCount)
		// 删除评论
		db.Debug().Model(&model.Comment{}).Delete(&comment1)
		// 获取删除评论后，对应文章评论数量
		var afterPostComment *model.Post
		db.Debug().Where("id = ?", comment1.PostID).First(&afterPostComment)
		fmt.Printf("执行删除后：文章ID：%d，文章评论数：%d\n", afterPostComment.ID, afterPostComment.CommentCount)
	}

}

func main() {
	db := globalFunc.InitDB()
	// sqlx := globalFunc.SqlxInitDB()
	// task_03_1_1(db)
	// task_03_1_2(db)
	// task_03_2_1(sqlx)
	// task_03_2_2(sqlx)
	task_03_3_1(db)
	task_03_3_2(db)
	task_03_3_3(db)

}
