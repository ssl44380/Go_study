// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockV3Aggregator is AggregatorV3Interface {
    uint8 public decimals;
    int256 private _answer;

    constructor(uint8 decimals_, int256 answer_) {
        decimals = decimals_;
        _answer = answer_;
    }

    function latestRoundData() external view override returns (
        uint80,
        int256,
        uint256,
        uint256,
        uint80
    ) {
        return (0, _answer, 0, 0, 0);
    }

    function getRoundData(uint80) external pure override returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (0, 0, 0, 0, 0);
    }

    function description() external pure override returns (string memory) {
        return "Mock Feed";
    }

    // function decimals()  external view override returns (uint8) {
    //     return decimals;
    // }

    function version() external pure override returns (uint256) {
        return 1;
    }
}





