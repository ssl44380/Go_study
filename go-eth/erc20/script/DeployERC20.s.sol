// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script,console} from "forge-std/Script.sol";
import {MyERC20} from "../src/MyERC20.sol";

/**
 * @author  .
 * @title   DeployERC20 .
 * @dev     部署DeployERC20合约脚本 .
 * @notice  .
 */

contract DeployERC20Script is Script {

    // 代币名称
    string constant TOKEN_NAME="MyToken";
    // 代币符号
    string constant TOKEN_SYMBOL="MTK";
    // 出事供应量（1000个代币，18位小数）
    uint256 constant INITIAL_SUPPLY=1000 * 10 ** 18;

    function setUp() public {}

    function run() public returns(address) {
        // 获取部署者地址作为初始代币接受者
        address deployer = msg.sender;

        // 如果要部署到本地链，可以使用以下方式获取地址
        // address deployer = vm.envAddress("DEPLOYER_ADDRESS");

        console.log("Deploying ERC20 token...");
        console.log("Token Name:", TOKEN_NAME);
        console.log("Token Symbol:", TOKEN_SYMBOL);
        console.log("Token Supply:", INITIAL_SUPPLY);
        console.log("Token Recipient:", deployer);


        vm.startBroadcast();

        // 部署 ERC20 合约
        MyERC20 token = new MyERC20(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            INITIAL_SUPPLY,
            deployer
        );

        vm.stopBroadcast();

        console.log("ERC20 Token deployed at:", address(token));
        console.log("Deployer balance:", token.balanceOf(deployer));

        return address(token);
    }
}
