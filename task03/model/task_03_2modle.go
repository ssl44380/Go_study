package model

type DepartmentEnum string

const (
	DeptHR      DepartmentEnum = "人事部"
	DeptTech    DepartmentEnum = "技术部"
	DeptFinance DepartmentEnum = "财务部"
	DeptMarket  DepartmentEnum = "销售部"
)

type Employee struct {
	Name       string
	Department string
	Salary     float64
}

type Book struct {
	ID     int
	Title  string
	Author string
	Price  float64
}
