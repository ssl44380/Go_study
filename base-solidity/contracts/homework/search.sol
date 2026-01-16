// SPDX-License-Identifier: MIT
pragma solidity ~0.8;

// 1 2 3 4 5 6    1 6   4>3.5  3=7%3!=0 
contract search{
    function  binarySearch(int[] calldata  arr,int256  num)public pure returns (int256){
        uint256 leftInterval;
        uint256 len1 =arr.length;
        if (len1==0)return -1;
        uint256 rightInterval = len1-1;
        int256 targetNum =num;
        uint count =len1/2;
        if (len1==1 && targetNum==arr[0])return 0;
        for(uint i;i<count;i++){
                if (targetNum==arr[leftInterval])return int(leftInterval);
                if (targetNum==arr[rightInterval])return int(rightInterval);
                uint256  medianIndex=(leftInterval+rightInterval)/2;
                int256  median=arr[medianIndex];
                if (targetNum>median){
                    leftInterval=medianIndex;
                }else if (targetNum<median){
                    rightInterval=medianIndex;
                }else{
                    return int(medianIndex);
                }
            }


        return -1;
    }
}

