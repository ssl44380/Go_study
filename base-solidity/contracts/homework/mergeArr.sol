// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// test : 
// arr1 [1,2,3]
// arr2 [2,3,4]
// result  uint256[]: 1,2,2,3,3,4

contract mergeArr{

    function merge(uint[] calldata arr1,uint[] calldata arr2)public pure returns(uint[] memory){
        uint len1 = arr1.length;
        uint len2 = arr2.length;
        uint[] memory result = new uint[](len1 + len2);
        uint i = 0;
        uint j = 0;
        uint k = 0;

        while (i<len1 && j<len2){
            if (arr1[i]<arr2[j]){
                result[k++]=arr1[i++];
            }else if(arr1[i]==arr2[j]){
                result[k++]=arr1[i++];
                result[k++]=arr2[j++];
            }else{
                result[k++]=arr2[j++];
            }

        }

        while (i < len1){
            result[k++]=arr1[i++];
        }

        while (j<len2){
            result[k++]=arr2[j++];
        }



        return result;

    }

}