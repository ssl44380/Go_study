
// SPDX-License-Identifier: MIT
pragma solidity ^0.8;



// 1. ✅ 创建一个名为Voting的合约，包含以下功能：
// 一个mapping来存储候选人的得票数
// 一个vote函数，允许用户投票给某个候选人
// 一个getVotes函数，返回某个候选人的得票数
// 一个resetVotes函数，重置所有候选人的得票数


contract Voting{
    mapping(address  => uint256 )  votes;

    function getVotes(address username)public view  returns  (uint256 getVote){
        getVote = votes[username];
    }

    function resetVotes(address username)public {
        votes[username] = 0;
    }

    function vote(address username,uint256 giveVote)public  {
        votes[username] = giveVote;
    }
}

