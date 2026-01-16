package main

import (
	"fmt"
	"strconv"
	"strings"
)

// -------------------------------singleNumber--------------------------------------

// 给定一个非空整数数组，除了某个元素只出现一次以外，其余每个元素均出现两次。找出那个只出现了一次的元素。可以使用 for 循环遍历数组，结合 if 条件判断和 map数据结构来解决，例如通过 map记录每个元素出现的次数，然后再遍历map找到出现次数为1的元素。

func singleNumber() {
	i := [9]int{9, 2, 3, 4, 5, 5, 4, 3, 2}
	fmt.Println("给定的非空整数组为:", i)
	var countNum = make(map[string]int)
	for _, value := range i {
		key := fmt.Sprintf("%d", value)
		if value, exists := countNum[key]; exists {
			countNum[key] = value + 1
		} else {
			countNum[key] = 1
		}
	}
	for index, value := range countNum {
		if value == 1 {
			fmt.Printf("给定非空整数数组中数字 %s 出现了 %d 次\n", index, value)
		}
	}

}

// -------------------------------isPalindrome--------------------------------------

// 考察：数字操作、条件判断 题目：判断一个整数是否是回文数

func isPalindrome() {
	// 定义一个整数a
	a := 1112
	// 将整数a转换为字符串格式b
	b := fmt.Sprintf("%d", a)
	//将字符串b转换成rnne形式,也可以直接使用string,或者使用byte
	ss := []rune(b)
	//计算循环次数
	count := len(ss)/2 + len(ss)%2
	//计算转换完以后得ss的长度
	ssLen := len(ss)
	//初始化变量i=1，如果i<=count，i加一，否则终止循环
	for i := 1; i <= count; i++ {
		//判断第i个字符和倒数第i个字符是否相等，如果相等则执行if，否则执行else（判断a不是回文数，并终止循环）
		if string(ss[i]) == string(ss[ssLen-i]) {
			//当i==count时，依然满足第i个字符和倒数第i个字符相等，判断a是回文数，并结束循环
			if i == count {
				fmt.Printf("数字:%d,是回文数\n", a)
			}
		} else {
			fmt.Printf("数字:%d,不是回文数\n", a)
			break
		}
	}
}

// -------------------------------isValid--------------------------------------

// 考察：字符串处理、栈的使用 题目：给定一个只包括 '('，')'，'{'，'}'，'['，']' 的字符串，判断字符串是否有效
// 链接：https://leetcode-cn.com/problems/valid-parentheses/
func isValid_process(s string) bool {
	stack := []byte{}
	pairs := map[byte]byte{
		'(': ')',
		'[': ']',
		'{': '}',
	}
	for i := 0; i < len(s); i++ {
		if v, ok := pairs[s[i]]; ok {
			stack = append(stack, v)
		} else {
			if len(stack) == 0 {
				return false
			} else if s[i] != stack[len(stack)-1] {
				return false
			} else {
				stack = stack[:len(stack)-1]
			}
		}
	}
	return len(stack) == 0

}

func isValid() {
	s := "[)]]"
	fmt.Println("给定字符串为:", s)
	if isValid_process(s) {
		fmt.Println("该字符串有效")
	} else {
		fmt.Println("该字符串无效")
	}

}

// -------------------------------longestCommonPrefix--------------------------------------
// 考察：字符串处理、循环嵌套 题目：查找字符串数组中的最长公共前缀
// 链接：https://leetcode-cn.com/problems/longest-common-prefix/
func longestCommonPrefix_judge(strs []string) string {
	// 处理空输入的情况
	if len(strs) == 0 {
		return ""
	}
	var public_str string
	//取第一个单词的每个字母，在其他单词中遍历
	for i := 0; i < len(strs[0]); i++ {
		for j := 1; j < len(strs); j++ {
			// fmt.Println("比较中的单词：", strs[0], strs[j])
			if strs[0][:i+1] == strs[j][:i+1] {
				public_str = strs[0][:i+1]
			} else {
				return strs[0][:i]
			}
		}

	}
	return public_str

}

func longestCommonPrefix() {

	strs := []string{"flower", "flow", "flight"}
	fmt.Println("给定单词数组为:", strs)
	// strs := []string{"dog", "racecar", "car"}
	public_str := longestCommonPrefix_judge(strs)
	fmt.Println("公共前缀为:", public_str)

}

// -------------------------------plusOne--------------------------------------

// 考察：数组操作、进位处理 题目：给定一个由整数组成的非空数组所表示的非负整数，在该数的基础上加一
// 链接：https://leetcode-cn.com/problems/plus-one/
func plusOne_process(digits []int) []int {
	var reslute []int
	var result strings.Builder
	for _, value := range digits {
		result.WriteString(fmt.Sprint(value))
	}
	plusNmb, _ := strconv.Atoi(result.String())
	plusOne := []rune(fmt.Sprint(plusNmb + 1))
	for _, value := range plusOne {
		j, _ := strconv.Atoi(string(value))
		reslute = append(reslute, j)
	}
	return reslute

}

func plusOne() {
	digits := []int{1, 2, 3}
	fmt.Println("给定整数数组为:", digits)
	// digits := []int{4, 3, 2, 1}
	// digits := []int{9}
	result := plusOne_process(digits)
	fmt.Println("整体加1后,再次返还成数组为:", result)

}

// -------------------------------removeDuplicates--------------------------------------

// 删除有序数组中的重复项：给你一个有序数组 `nums` ，请你原地删除重复出现的元素，使每个元素只出现一次，返回删除后数组的新长度。不要使用额外的数组空间，你必须在原地修改输入数组并在使用 O(1) 额外空间的条件下完成。可以使用双指针法，一个慢指针 `i` 用于记录不重复元素的位置，一个快指针 `j` 用于遍历数组，当 `nums[i]` 与 `nums[j]` 不相等时，将 `nums[j]` 赋值给 `nums[i + 1]`，并将 `i` 后移一位。

// 链接：https://leetcode-cn.com/problems/remove-duplicates-from-sorted-array/

func removeDuplicates_process(nums []int) int {
	if len(nums) == 0 {
		return len("")
	}
	i := 0
	for j := i; j < len(nums); j++ {
		if nums[j] > nums[i] {
			nums[i+1] = nums[j]
			i++
		}

	}
	return len(nums[:i+1])
}

func removeDuplicates() {
	// nums := []int{1, 1, 2}
	nums := []int{0, 0, 1, 1, 1, 2, 2, 3, 3, 4}
	fmt.Println("给定整数数组为:", nums)
	reslut := removeDuplicates_process(nums)
	fmt.Println("删除重复项后数组长度为:", reslut)

}

// -------------------------------merge--------------------------------------

// 合并区间：以数组 `intervals` 表示若干个区间的集合，其中单个区间为 `intervals[i] = [starti, endi]` 。请你合并所有重叠的区间，并返回一个不重叠的区间数组，该数组需恰好覆盖输入中的所有区间。可以先对区间数组按照区间的起始位置进行排序，然后使用一个切片来存储合并后的区间，遍历排序后的区间数组，将当前区间与切片中最后一个区间进行比较，如果有重叠，则合并区间；如果没有重叠，则将当前区间添加到切片中。

// 链接：https://leetcode.cn/problems/merge-intervals/description/

func merge_process(intervals [][]int) [][]int {
	// 空处理
	if len(intervals) == 0 {
		return [][]int{}
	}
	// 初始一个空数组
	var reslut [][]int
	// 将原来的数组列表按照左侧升序排列
	for i := 0; i < len(intervals)-1; i++ {
		for j := 0; j < len(intervals)-1-i; j++ {
			if intervals[j][0] > intervals[j+1][0] {
				intervals[j], intervals[j+1] = intervals[j+1], intervals[j]
			}
		}

	}
	// 将带判断数组列表中第一个数组，添加进去
	reslut = append(reslut, intervals[0])
	// 判断新数组数列中最后一个数组之后的左侧值，是否小于第一个数组的右侧值，如果小则有重合区间，则让新数组列表中的最后一个数组的第二个数和有重合区间的数组的第二个数取最大值
	for i := 0; i < len(intervals)-1; i++ {
		if reslut[len(reslut)-1][1] >= intervals[i+1][0] {
			if reslut[len(reslut)-1][1] < intervals[i+1][1] {
				reslut[len(reslut)-1][1] = intervals[i+1][1]
			}
		} else {
			reslut = append(reslut, intervals[i+1])
		}
	}
	// 如果没有重合区间，则直接把将要判断的数组添加进新数组列表中

	return reslut

}

func merge() {
	// intervals := [][]int{{1, 3},{2, 6},{15, 18},{8, 10},}

	intervals := [][]int{{1, 4}, {4, 5}}

	// intervals := [][]int{{1, 4}, {4, 7}}

	fmt.Println("合并区间前为:", intervals)

	reslut := merge_process(intervals)

	fmt.Println("合并区间后为:", reslut)

}

// -------------------------------twoSum--------------------------------------

// 考察：数组遍历、map使用 题目：给定一个整数数组 nums 和一个目标值 target，请你在该数组中找出和为目标值的那两个整数
// 链接：https://leetcode-cn.com/problems/two-sum/

func twoSum_process(nums []int, target int) []int {
	var reslut []int
OuterLoop:
	for i := 0; i <= len(nums); i++ {
		for j := i + 1; j <= len(nums)-1; j++ {
			if nums[i]+nums[j] == target {
				reslut = append(reslut, i, j)
				break OuterLoop
			}
		}

	}
	return reslut
}

func twoSum() {
	nums := []int{3, 2, 4}

	target := 6
	fmt.Println("给定整数数组为:", nums, "给定目标值为:", target)

	reslut := twoSum_process(nums, target)
	fmt.Println("返回的两个数索引值为:", reslut)

}

func main() {
	fmt.Printf("-----singleNumber-----\n")
	singleNumber()

	fmt.Printf("-----isPalindrome-----\n")
	isPalindrome()

	fmt.Printf("-----isValid-----\n")
	isValid()

	fmt.Printf("-----longestCommonPrefix-----\n")
	longestCommonPrefix()

	fmt.Printf("-----plusOne-----\n")
	plusOne()

	fmt.Printf("-----removeDuplicates-----\n")
	removeDuplicates()

	fmt.Printf("-----merge-----\n")
	merge()

	fmt.Printf("-----twoSum-----\n")
	twoSum()
}
