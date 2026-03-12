// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./MetaNFTAuction.sol";


contract MetaNFTAuctionV2 is MetaNFTAuction{
    function testHello()public pure returns(string memory){
        return "Hello, World!";
    }

    function getVersion()public pure override returns(string memory){
        return "MetaNFTAuctionV2";
    }

}