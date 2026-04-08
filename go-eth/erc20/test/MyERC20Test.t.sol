// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {MyERC20} from "../src/MyERC20.sol";

contract MyERC20Test is Test {
    MyERC20 public token;
    address public deployer;
    address public user1;
    address public user2;

    string constant TOKEN_NAME="MyToken";
    string constant TOKEN_SYMBOL="MTK";
    uint256 constant INITIAL_SUPPLY=1000 * 10 ** 18;



    function setUp() public {
        // 设置账户地址
        deployer=address(this);
        user1=makeAddr("user1");
        user2=makeAddr("user2");
        
        // 部署erc20合约
        token = new MyERC20(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            INITIAL_SUPPLY,
            deployer
        );

    }

    function testInitialSupply() public view{
        assertEq(token.totalSupply(),INITIAL_SUPPLY);
        assertEq(token.balanceOf(deployer), INITIAL_SUPPLY);
    }

    function testTokenMetadata() public view {
        assertEq(token.name(),TOKEN_NAME);
        assertEq(token.symbol(),TOKEN_SYMBOL);
        assertEq(token.decimals(), 18);
    }

    function testTransfer()public {
        uint256 transferAmount =100 *10 **18;

        bool success=token.transfer(user1, transferAmount);
        require(success);

        assertEq(token.balanceOf(deployer),INITIAL_SUPPLY-transferAmount);
        assertEq(token.balanceOf(user1),transferAmount);
    }

    function testTransferFrom()public{
        uint256 approveAmount = 200* 10**18;
        uint256 transferAmount =150*10**18;
        token.approve(user1, approveAmount);
        vm.prank(user1);
        require(token.transferFrom(deployer, user2, transferAmount), "Transfer failed");
        vm.stopPrank();

        assertEq(token.balanceOf(deployer),INITIAL_SUPPLY-transferAmount);
        assertEq(token.balanceOf(user2),transferAmount);
        assertEq(token.allowance(deployer, user1), approveAmount-transferAmount);
    }

    function testMint()public{
        uint256 mintAmount=500*10**18;
        token.mint(user1, mintAmount);

        assertEq(token.balanceOf(user1),mintAmount);
        assertEq(token.totalSupply(),INITIAL_SUPPLY+mintAmount);
    }

    function testTransferInsufficientBalance()public{
        uint256 excessAmount=INITIAL_SUPPLY+1;
        vm.expectRevert();
        require(token.transfer(user1, excessAmount),"Transfer failed");
    }

    function testTransferFromInsufficientAllowance()public{
        uint256 approveAmount=100*10**18;
        uint256 transferAmount=200*10**18;

        token.approve(user1, approveAmount);

        vm.prank(user1);
        vm.expectRevert();
        bool success=token.transferFrom(deployer, user1, transferAmount);
        require(success);
    }
}

