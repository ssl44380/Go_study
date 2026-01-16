package main

import (
	"task04/global"
	"task04/initapp"
)

// "task04/global"

func main() {
	global.GLOBAL_Logger = initapp.InitCoustomLevelLogger("[MyBlogApp]")
	global.GLOBAL_DB = initapp.InitGorm()
	initapp.RegisterTables()
	global.GLOBAL_Logger.Info("register table success")
	global.GLOBAL_Logger.Error("register table success")
	initapp.Router()
}
