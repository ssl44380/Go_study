// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MetaUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}
    function mint(address to,uint256 amount)external{
        _mint(to, amount);
    }
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}