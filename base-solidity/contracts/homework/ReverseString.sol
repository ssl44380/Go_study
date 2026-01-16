// SPDX-License-Identifier: MIT
pragma solidity ~0.8.20;

// 2. ✅ 反转字符串 (Reverse String)
// 题目描述：反转一个字符串。输入 "abcde"，输出 "edcba"

contract ReverseString{
    function reverseString(string calldata input) public pure returns(string memory){
        if(bytes(input).length == 0) {
            return ""; 
        }
        bytes memory temp = bytes(input);
        uint256 len = temp.length;

    
        for(uint256 i=0;i < len / 2;i++){
            bytes1 swap = temp[i];
            temp[i]=temp[len-1-i];
            temp[len-1-i]=swap;
        }
        return string(temp);
    }
}