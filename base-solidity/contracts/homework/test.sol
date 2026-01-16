// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DonationContract
 * @dev 实现捐赠记录、以太币捐赠、所有者提现、查询捐赠金额的核心功能
 */
contract DonationContract {
    // ======== 状态变量 ========
    // 合约所有者地址（部署合约的账户）
    address public immutable owner;
    
    // mapping：记录每个捐赠者的累计捐赠金额（address => 捐赠金额(wei)）
    mapping(address => uint256) public donationAmount;

    // ======== 事件定义（可选，用于追溯交易记录） ========
    event Donated(address indexed donator, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed owner, uint256 totalAmount, uint256 timestamp);

    // ======== 构造函数：初始化合约所有者 ========
    constructor() {
        // 将部署合约的账户设为所有者
        owner = msg.sender;
    }

    // ======== 自定义修饰符：仅所有者可调用 ========
    modifier onlyOwner() {
        require(msg.sender == owner, "Donation: only owner can call this function");
        _;
    }

    // ======== 核心功能1：donate 函数 - 接收用户捐赠并记录信息 ========
    /**
     * @dev 允许用户向合约发送以太币，并记录捐赠者的捐赠金额
     * @notice 调用时需附带以太币（msg.value），金额需大于0
     */
    function donate() external payable {
        // 校验1：捐赠金额（msg.value）大于0（避免无意义捐赠）
        require(msg.value > 0, "Donation: amount must be greater than 0");
        
        // 记录捐赠者的累计捐赠金额（累加本次捐赠的 msg.value）
        donationAmount[msg.sender] += msg.value;
        
        // 触发捐赠事件（方便前端/区块链浏览器追溯记录）
        emit Donated(msg.sender, msg.value, block.timestamp);
    }

    // ======== 核心功能2：withdraw 函数 - 允许所有者提取合约所有资金 ========
    /**
     * @dev 仅合约所有者可调用，提取合约中的所有以太币到所有者地址
     * @notice 提取前需确保合约有余额，避免无意义操作
     */
    function withdraw() external onlyOwner {
        // 校验1：合约余额大于0（避免无资金可提取）
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "Donation: contract has no balance to withdraw");
        
        // 提取所有资金到所有者地址（使用 address.transfer 实现提款）
        // 所有者地址转换为 payable 类型（transfer 仅支持 address payable）
        payable(owner).transfer(contractBalance);
        
        // 触发提现事件（追溯提现记录）
        emit Withdrawn(owner, contractBalance, block.timestamp);
    }

    // ======== 核心功能3：getDonation 函数 - 查询指定地址的捐赠金额 ========
    /**
     * @dev 查询某个地址的累计捐赠金额
     * @param donator 要查询的捐赠者地址
     * @return 该地址的累计捐赠金额（单位：wei）
     */
    function getDonation(address donator) external view returns (uint256) {
        // 直接返回 mapping 中记录的捐赠金额
        return donationAmount[donator];
    }

    // ======== 辅助函数：查询合约当前余额（可选，方便验证） ========
    /**
     * @dev 查询合约当前的以太币余额
     * @return 合约余额（单位：wei）
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}