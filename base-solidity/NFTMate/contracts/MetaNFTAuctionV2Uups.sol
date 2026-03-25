// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./MetaNFTAuctionUups.sol";



contract MetaNFTAuctionUupsV2 is MetaNFTAuctionUups{
        constructor() {
        _disableInitializers();
    }
    function testHello()public pure returns(string memory){
        return "Hello, World!";
    }
    
    function getVersion()public pure override returns(string memory){
        return "MetaNFTAuctionV2";
    }



}