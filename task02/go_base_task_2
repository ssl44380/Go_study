package main

import (
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"time"
)

// -------------------------------pointer_task_1--------------------------------------
// 题目 ：编写一个Go程序，定义一个函数，该函数接收一个整数指针作为参数，在函数内部将该指针指向的值增加10，然后在主函数中调用该函数并输出修改后的值。考察点 ：指针的使用、值传递与引用传递的区别。
func palsTen(num *int) int {
	*num = *num + 10
	return *num
}
func pointer_task_1() {
	num := 10
	fmt.Println("startNum:::", num)
	reslut := palsTen(&num)
	fmt.Println("reslutNum:::", reslut)

}

//-------------------------------pointer_task_2--------------------------------------
// 题目 ：实现一个函数，接收一个整数切片的指针，将切片中的每个元素乘以2。考察点 ：指针运算、切片操作。

func multiplicationTwo(nums *[]int) []int {
	for i, v := range *nums {
		(*nums)[i] = v * 2
	}

	return *nums
}
func pointer_task_2() {
	nums := []int{1, 1, 2}
	fmt.Println("start_nums:::", nums)
	reslut := multiplicationTwo(&nums)
	fmt.Println("reslut_nums:::", reslut)

}

//-------------------------------Goroutine_task_1--------------------------------------

// 题目 ：编写一个程序，使用 go 关键字启动两个协程，一个协程打印从1到10的奇数，另一个协程打印从2到10的偶数。考察点 ： go 关键字的使用、协程的并发执行。

// 定义一个打印奇数的函数，并通过通道发送结果
func printOdd(ch_odd chan<- int) {
	// 打印1-10中奇数
	for i := 1; i <= 10; i++ {
		if i%2 == 1 {
			ch_odd <- i
		}
	}
	// 关闭通道
	fmt.Println("奇数通道关闭前...")
	close(ch_odd)
	fmt.Println("奇数通道关闭后...")
}

// 定义一个打印偶数的函数
func printEven(ch_even chan<- int) {
	// 打印2-10中偶数
	for i := 2; i <= 10; i++ {
		if i%2 == 0 {
			ch_even <- i
		}
	}
	// 关闭通道
	fmt.Println("偶数通道关闭前...")
	close(ch_even)
	fmt.Println("偶数通道关闭后...")
}

func Goroutine_task_1() {
	// make一个有缓存通道用于奇数传递
	ch_odd := make(chan int, 3)
	// fmt.Printf("ch_odd通道类型为%T\n", ch_odd)
	// make一个无缓存通道用于偶数传递
	ch_even := make(chan int)
	// fmt.Printf("ch_evne通道类型为%T\n", ch_even)

	// 调用打印奇数函数，并使用goroutine-odd通道发送数据
	go printOdd(ch_odd)
	// go printOdd(chan_odd)
	// 调用打印偶数函数，并使用goroutine-odd通道发送数据
	go printEven(ch_even)

	// 定义一个超时时间，用于超时结束
	timeout := time.After(2 * time.Second)

	// 设置两个变量用于判定什么时候停止执行for循环
	ch_odd_running := true
	ch_even_running := true

	// select配合for实现多路复用
	// 如果select不配for则通道使用一次就结束了，不配合for使用的情况主要用于测试场景连通性

	for ch_odd_running || ch_even_running {
		// 使用select分配case接受通道传递的内容并打印
		select {
		// 接受到奇数打印奇数
		// 使用ok判断机制，判断通道是否关闭，如果关闭则跳出循环
		case oddNum, ok := <-ch_odd:
			if ok {
				fmt.Printf("这是1-10之中的奇数:%d\n", oddNum)
			} else {
				ch_odd_running = false
				fmt.Println("奇数传送通道已关闭......")
			}

		// 接收到偶数打印偶数
		case evenNum, ok := <-ch_even:
			if !ok {
				ch_even_running = false
				fmt.Println("偶数传送通道已关闭......")
			} else {
				fmt.Printf("这是1-10之中的偶数:%d\n", evenNum)
			}

		// 超时则结束
		case <-timeout:
			fmt.Printf("操作超时......\n")
			return
		// default 用于没有满足case情况时执行的操作
		default:
			fmt.Println("没有数据等待中......\n")
			time.Sleep(500 * time.Millisecond)
		}
	}

}

//-------------------------------Goroutine_task_2--------------------------------------

// 题目 ：设计一个任务调度器，接收一组任务（可以用函数表示），并使用协程并发执行这些任务，同时统计每个任务的执行时间。考察点 ：协程原理、并发任务调度。
// 计算任务运行时间
func countTaskTime(i int, wg *sync.WaitGroup) {
	defer wg.Done()
	startTimer := time.Now()
	fmt.Printf("任务%d开始执行任务...\n", i)
	time.Sleep(time.Duration(i) * time.Second)
	fmt.Printf("任务%d执行结束,共执行时间%v\n", i, time.Since(startTimer))

}

// 创建一个调度器

func taskScheduler(tasks []int) {
	// 声明一个sync.WaitGroup
	var wg sync.WaitGroup
	// 每向等待完成的任务组中添加一个任务，便开始执行该任务
	for _, i := range tasks {
		wg.Add(1)
		go countTaskTime(i, &wg)

	}
	// 等待全部任务都结束
	wg.Wait()
}

func Goroutine_task_2() {
	// 创建一个空列表
	tasks := []int{}
	// 向任务列表中添加3个任务
	for i := 0; i < 3; i++ {
		tasks = append(tasks, i+1)
	}

	// 通过调度器执行任务列表中的任务
	taskScheduler(tasks)
}

//-------------------------------object_oriented_task_1--------------------------------------

// 题目 ：定义一个 Shape 接口，包含 Area() 和 Perimeter() 两个方法。然后创建 Rectangle 和 Circle 结构体，实现 Shape 接口。在主函数中，创建这两个结构体的实例，并调用它们的 Area() 和 Perimeter() 方法。考察点 ：接口的定义与实现、面向对象编程风格。

// 定义一个Shape类型接口，其中有两个方法的接口一个是面积方法，另一个是周长方法
type Shape interface {
	Area() float64
	Perimeter() float64
}

// 定义一个矩形（Rectangle）结构体，结构体中有高、宽（均为64位浮点型）
type Rectangle struct {
	Height float64
	Width  float64
}

// 定义一个圆形（Circle）结构体，结构体中有半径（均为64位浮点型）
type Circle struct {
	Radius float64
}

// 定义求圆形的Area方法
func (c Circle) Area() float64 {
	return math.Pi * c.Radius * c.Radius
}

// 定义求圆形的Perimeter方法
func (c Circle) Perimeter() float64 {
	return 2 * math.Pi * c.Radius
}

// 定义求矩形的Area方法
func (r Rectangle) Area() float64 {
	return r.Width * r.Height
}

// 定义求矩形的Perimeter方法
func (r Rectangle) Perimeter() float64 {
	return 2 * (r.Width + r.Height)
}

// 使用Shape接口函数计算
func calculateArea(s Shape) float64 {
	return s.Area()
}
func calculatePerimeter(s Shape) float64 {
	return s.Perimeter()
}

func object_oriented_task_1() {
	// New一个Rectangle
	juXing := Rectangle{Height: 2, Width: 3}
	// New一个Rectangle
	yuanXing := Circle{Radius: 5}
	// 计算juXing周长和面积并打印
	jXArea := calculateArea(juXing)
	jXPerimeter := calculatePerimeter(juXing)
	fmt.Printf("矩形高:%.2f,宽:%.2f,面积:%.2f,周长:%.2f\n", juXing.Height, juXing.Width, jXArea, jXPerimeter)
	// 计算yuanXing周长和面积并打印
	yArea := calculateArea(yuanXing)
	yPerimeter := calculatePerimeter(yuanXing)
	fmt.Printf("圆形半径:%.2f,面积:%.2f,周长:%.2f\n", yuanXing.Radius, yArea, yPerimeter)

}

//-------------------------------object_oriented_task_2--------------------------------------

// 题目 ：使用组合的方式创建一个 Person 结构体，包含 Name 和 Age 字段，再创建一个 Employee 结构体，组合 Person 结构体并添加 EmployeeID 字段。为 Employee 结构体实现一个 PrintInfo() 方法，输出员工的信息。考察点 ：组合的使用、方法接收者。

type Person struct {
	Name string
	Age  int
}
type Employee struct {
	Person     Person
	EmployeeID int
}

func (e Employee) PrintInfo(ep Employee) {
	fmt.Printf("员工姓名:%s,员工年龄:%d,员工ID:%d", ep.Person.Name, ep.Person.Age, ep.EmployeeID)
}

func object_oriented_task_2() {
	empolyee := Employee{Person: Person{Name: "LiLing", Age: 22}, EmployeeID: 2025222498}
	empolyee.PrintInfo(empolyee)
}

//-------------------------------channel_task_1--------------------------------------

// 题目 ：编写一个程序，使用通道实现两个协程之间的通信。一个协程生成从1到10的整数，并将这些整数发送到通道中，另一个协程从通道中接收这些整数并打印出来。考察点 ：通道的基本使用、协程间通信。

// 定义一个生成1-10的函数
func generateNums(ch chan<- int) {
	for i := 0; i < 10; i++ {
		ch <- i + 1
	}
	// 发送结束关闭通道
	close(ch)
}

// 定义一个从通道中接受数据的函数
func reciveNums(ch <-chan int) {
	for num := range ch {
		fmt.Printf("这是整数%d\n", num)
	}

}

func channel_task_1() {
	// make一个通道用于通道
	ch := make(chan int)
	// go执行生成1-10的函数,并执行接受通道数据的函数
	go generateNums(ch)
	go reciveNums(ch)
	// 等待一段时间确保所有goroutine都完成
	time.Sleep(2 * time.Second)
}

//-------------------------------channel_task_2--------------------------------------

//题目 ：实现一个带有缓冲的通道，生产者协程向通道中发送100个整数，消费者协程从通道中接收这些整数并打印。考察点 ：通道的缓冲机制。

// 定义一个生成1-10的函数
func producer(ch chan<- int) {
	for i := 0; i < 100; i++ {
		ch <- i + 1
	}
	// 发送结束关闭通道
	close(ch)
}

// 定义一个从通道中接受数据的函数
func consumer(ch <-chan int) {
	for num := range ch {
		fmt.Printf("这是整数%d\n", num)
	}

}

func channel_task_2() {
	// make一个通道用于通道
	ch := make(chan int, 10)
	// go执行生成1-10的函数,并执行接受通道数据的函数
	go producer(ch)
	go consumer(ch)
	// 等待一段时间确保所有goroutine都完成
	time.Sleep(2 * time.Second)

}

//-------------------------------lock_mechanism_taks_1--------------------------------------

// 题目 ：编写一个程序，使用 sync.Mutex 来保护一个共享的计数器。启动10个协程，每个协程对计数器进行1000次递增操作，最后输出计数器的值。考察点 ： sync.Mutex 的使用、并发数据安全。

// 定义一个计数器结构体包括一个琐，还有一个数
type Counter struct {
	mu  sync.Mutex
	Num int
}

func (c *Counter) increaseCounterNums(addend int) {
	defer c.mu.Unlock()
	c.mu.Lock()
	c.Num += addend
}

func (c *Counter) getCounterNums() int {
	return c.Num
}

func counterIncrease(addodd, coun int, c1 *Counter) {

	for i := 0; i < 10; i++ {
		go func() {
			for i := 0; i < coun; i++ {
				c1.increaseCounterNums(addodd)
			}
		}()
	}
	// 等待2秒确保所有的goroutine完成
	time.Sleep(2 * time.Second)

}

func lock_mechanism_taks_1() {
	// 初始化c1计数器，获取初始Num值
	c1 := Counter{}
	fmt.Printf("计数器初始值:%d\n", c1.Num)
	// 设置每次递增量，和递增次数，执行递增操作
	addodd := 1  //每次递增量
	coun := 1000 //每个协程递增次数
	counterIncrease(addodd, coun, &c1)
	// 打印递增结束之后计数器的值
	fmt.Printf("计数器最终值:%d\n", c1.Num)
}

//-------------------------------lock_mechanism_taks_2--------------------------------------

// 题目 ：使用原子操作（ sync/atomic 包）实现一个无锁的计数器。启动10个协程，每个协程对计数器进行1000次递增操作，最后输出计数器的值。考察点 ：原子操作、并发数据安全。

// 定义一个原子无锁计数器结构体，结构体内部只有一个值
type AtomicCounter struct {
	value int64
}

func (a *AtomicCounter) Increment() {
	atomic.AddInt64(&a.value, 1)
}

func (a *AtomicCounter) Decrement() {
	atomic.AddInt64(&a.value, -1)
}

func (a *AtomicCounter) GetValue() {
	atomic.LoadInt64(&a.value)
}

func lock_mechanism_taks_2() {
	var wg sync.WaitGroup
	c2 := &AtomicCounter{}
	// 打印原子无锁计数器递增结束之前计数器的值
	fmt.Printf("原子无锁计数器初始值:%d\n", c2.value)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 1000; i++ {
				c2.Increment()
			}
		}()
	}
	wg.Wait()
	// 打印原子无锁计数器递增结束之后计数器的值
	fmt.Printf("原子无锁计数器最终值:%d\n", c2.value)

}

func main() {
	fmt.Printf("-----pointer_task_1-----\n")
	pointer_task_1()
	fmt.Printf("-----pointer_task_2-----\n")
	pointer_task_2()
	fmt.Printf("-----Goroutine_task_1-----\n")
	Goroutine_task_1()
	fmt.Printf("-----Goroutine_task_2-----\n")
	Goroutine_task_2()
	fmt.Printf("-----object_oriented_task_1-----\n")
	object_oriented_task_1()
	fmt.Printf("-----object_oriented_task_2-----\n")
	object_oriented_task_2()
	fmt.Printf("-----channel_task_1-----\n")
	channel_task_1()
	fmt.Printf("-----channel_task_2-----\n")
	channel_task_2()
	fmt.Printf("-----lock_mechanism_taks_1-----\n")
	lock_mechanism_taks_1()
	fmt.Printf("-----lock_mechanism_taks_2-----\n")
	lock_mechanism_taks_2()

}
