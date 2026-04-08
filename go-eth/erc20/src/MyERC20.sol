// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/**
 * @author  .
 * @title   MyERC20 .
 * @dev     一个简单的erc20合约基于openzeppelin 实现 .
 * @notice  .
 */

contract MyERC20 is ERC20 {

    constructor(
        string memory name, 
        string memory symbol,
        uint256 initialSupply,
        address recipient
    )ERC20(name,symbol) {
        _mint(recipient, initialSupply);
    }
    
    /**
     * @notice  .
     * @dev     允许合约所有者铸造代币 .
     * @param   to 接收代币的地址 . 
     * @param   amount  铸造代币的数量.
     */
    function mint(address to,uint256 amount)public {
        _mint(to, amount);
    }

    
}