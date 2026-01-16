// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 七个不同的符号代表罗马数字，其值如下：

// 符号	值
// I	1
// V	5
// X	10
// L	50
// C	100
// D	500
// M	1000
// 罗马数字是通过添加从最高到最低的小数位值的转换而形成的。将小数位值转换为罗马数字有以下规则：

// 如果该值不是以 4 或 9 开头，请选择可以从输入中减去的最大值的符号，将该符号附加到结果，减去其值，然后将其余部分转换为罗马数字。
// 如果该值以 4 或 9 开头，使用 减法形式，表示从以下符号中减去一个符号，例如 4 是 5 (V) 减 1 (I): IV ，9 是 10 (X) 减 1 (I)：IX。仅使用以下减法形式：4 (IV)，9 (IX)，40 (XL)，90 (XC)，400 (CD) 和 900 (CM)。
// 只有 10 的次方（I, X, C, M）最多可以连续附加 3 次以代表 10 的倍数。你不能多次附加 5 (V)，50 (L) 或 500 (D)。如果需要将符号附加4次，请使用 减法形式。
// 给定一个整数，将其转换为罗马数字。

// 示例 1：

// 输入：num = 3749

// 输出： "MMMDCCXLIX"

// 解释：

// 3000 = MMM 由于 1000 (M) + 1000 (M) + 1000 (M)
//  700 = DCC 由于 500 (D) + 100 (C) + 100 (C)
//   40 = XL 由于 50 (L) 减 10 (X)
//    9 = IX 由于 10 (X) 减 1 (I)
// 注意：49 不是 50 (L) 减 1 (I) 因为转换是基于小数位
// 示例 2：

// 输入：num = 58

// 输出："LVIII"

// 解释：

// 50 = L
//  8 = VIII
// 示例 3：

// 输入：num = 1994

// 输出："MCMXCIV"

// 解释：

// 1000 = M
//  900 = CM
//   90 = XC
//    4 = IV
 

// 提示：

// 1 <= num <= 3999

contract intToRoman{
    // // 方法一：消耗gas过多
    // function toR(uint256 i)private  pure returns  (string memory){
    //     if (i == 1000)return 'M';
    //     if (i == 500)return 'D';
    //     if (i == 100)return 'C';
    //     if (i == 50)return 'L';
    //     if (i == 10)return 'X';
    //     if (i == 5)return 'V';
    //     if (i == 1)return 'I';
    //     return "";
    // }
    // function repeatString(string memory str,uint256 count)private  pure  returns (string memory){
    //     string memory temp ="";
    //     for (uint256 i =0;i<count;i++){
    //         temp = string.concat(temp,str);
    //     }
    //     return temp;
    // }
    // function intToRoma(uint256 num) public pure returns (string memory) {
    //     string memory str = "";
    //     for(uint256 i = 1;i<=num; i=i*10){
    //         uint256 remainder =num%(i*10);
    //         num = num-remainder;
    //         if (remainder>=0){
    //             if(remainder==i*10-i) str = string.concat(toR(i),toR(i*10),str);
    //             if(remainder>= 5*(i) && remainder<i*10-i) str = string.concat(toR(5*i),repeatString(toR(i),(remainder- 5*i)/i),str);
    //             if(remainder==4*(i)) str = string.concat(toR(i),toR(5*i),str);
    //             if(remainder<4*(i) && remainder>0) str = string.concat(repeatString(toR(i),remainder/i),str);
    //         }

           
    //     }
    //     return str;
        
    // }

    // 方法一：消耗gas少
    function intToRoman1(uint256 num)public pure returns(string memory){
        if(num == 0)return "";
        if(num>3999)return "Exceeds 3999";
        bytes memory resultBytes=new bytes(15);
        uint256 resultIndex=0;
        uint256 remaining=num;
        for (uint256 i=0;i<13 && remaining>0;i++){
            uint256 value;
            bytes memory symbol;
            if(i==0){
                value=1000;
                symbol="M";
            }else if (i == 1) {
                value = 900;
                symbol = "CM";
            } else if (i == 2) {
                value = 500;
                symbol = "D";
            } else if (i == 3) {
                value = 400;
                symbol = "CD";
            } else if (i == 4) {
                value = 100;
                symbol = "C";
            } else if (i == 5) {
                value = 90;
                symbol = "XC";
            } else if (i == 6) {
                value = 50;
                symbol = "L";
            } else if (i == 7) {
                value = 40;
                symbol = "XL";
            } else if (i == 8) {
                value = 10;
                symbol = "X";
            } else if (i == 9) {
                value = 9;
                symbol = "IX";
            } else if (i == 10) {
                value = 5;
                symbol = "V";
            } else if (i == 11) {
                value = 4;
                symbol = "IV";
            } else if (i == 12) {
                value = 1;
                symbol = "I";
            }


            if(remaining < value) continue ;


            uint256 repeatCount =remaining /value ;
            remaining = remaining  % value;

            for (uint256 k = 0; k < repeatCount; k++) {
                for (uint256 j = 0; j < symbol.length; j++) {
                    resultBytes[resultIndex++] = symbol[j];
                }
            }
        }

        bytes memory finalBytes = new bytes(resultIndex);
        for (uint256 i = 0; i < resultIndex; i++) {
            finalBytes[i] = resultBytes[i];
        }

        return string(finalBytes);


    }


}