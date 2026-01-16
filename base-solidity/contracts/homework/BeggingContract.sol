// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


// 一个 mapping 来记录每个捐赠者的捐赠金额。
// 一个 donate 函数，允许用户向合约发送以太币，并记录捐赠信息。
// 一个 withdraw 函数，允许合约所有者提取所有资金。
// 一个 getDonation 函数，允许查询某个地址的捐赠金额。
// 使用 payable 修饰符和 address.transfer 实现支付和提款。


// 捐赠事件：添加 Donation 事件，记录每次捐赠的地址和金额。
// 捐赠排行榜：实现一个功能，显示捐赠金额最多的前 3 个地址。
// 时间限制：添加一个时间限制，只有在特定时间段内才能捐赠。



contract BeggingContract{
    // 获得的捐赠金额
    uint256 public totalDonationsEth;

    // 捐赠金额mapping
    mapping(address=>uint256) public donationAmount;

    // 捐赠者记录列表
    address[] public donationList;

    // 捐赠者存在性检验，数据量比较小时可不使用这个查询
    mapping(address=>bool) public isDonation;

    // 合约接受捐赠
    address payable immutable public recipient;

    // 合约所有者
    address public immutable owner;
    constructor(){
        owner=msg.sender;
        recipient=payable(owner);
    }

    // 日志事件模版
    event DonatedEvent(address indexed donator,uint256 amount,uint256 timestamp);
    event FallbackEthReceived(address indexed sender, uint256 amount, uint256 timestamp);

    // 接受转账，并发送事件日志
    receive() external  payable {
    }

    fallback() external payable {
        // 极简逻辑，确保 Gas 消耗不超过 2300
        emit FallbackEthReceived(msg.sender, msg.value, block.timestamp);
    }

    // 获取当前时间
    function getcurrentTimer()external  view returns(uint256){
        uint256 currentSecondOfDay = block.timestamp % 1 days;
        uint256 currentHour= currentSecondOfDay /1 hours;
        return currentHour;
    }

    // 自定义修饰符
    modifier timeLimit()  {
        uint256 currentSecondOfDay = block.timestamp % 1 days;
        uint256 currentHour= currentSecondOfDay /1 hours;
        require(currentHour >= 12 && currentHour < 13 ,"Voting is only allowed between 12:00 and 13:00 UTC");
        _;
    }

    modifier isAdmin(){
        // 校验执行用户是否为合约所有者
        require(msg.sender==owner,"No Admin");
        _;
    }

    // 获取用户可用余额
    function getUserBalanceEth()external  view returns(uint256){
        uint256 userbalance = msg.sender.balance / 1 ether;
        return userbalance;
    }

    // 获取合约可用余额
    function getBalanc()public   view returns(uint256){
        uint256 userbalance = address(this).balance;
        return userbalance;
    }

    function getUser()public view returns(address){
        return msg.sender;
    }



    // donate 函数，允许用户向合约发送以太币，并记录捐赠信息
    function donate(uint256 amountEth)external payable timeLimit  {
        // 单位换算
        uint256 amountWei = amountEth * 1 ether;
        // 缓存捐赠者余额,以及捐赠者地址信息
        address _sender=msg.sender;
        // 余额为0，或者捐赠金额超过余额，检验
        require(amountWei>0  ,"Balance Insufficient");
        require(msg.value >= amountWei, "Donation: insufficient transferred ETH");
        require(_sender != address(0) && recipient != address(0), "Donation: _sender and recipient invalid zero address");

        // 执行捐赠

        // 如果用户不存在则执行信息登记
        if(!isDonation[_sender]){
            // 在捐赠者列表中登记捐赠者
            donationList.push(_sender);
            // 记录捐赠者是存在
            isDonation[_sender]=true;
        }
         // 登记捐赠地址和捐赠金额
        donationAmount[_sender]+=amountWei;

        totalDonationsEth+=amountEth;

        // 捐赠者列表长度
        uint256 donationLen =donationList.length;

        // 重新给捐赠者排名
        for(uint256 i=0;i<3;i++){
            if(donationLen==1)break ;
            // 列表长度为2，比较两个人谁捐献多
            if(donationLen==2 && donationAmount[donationList[1]]>donationAmount[donationList[0]]){
                address newFirstPlace=donationList[1];
                donationList[1]=donationList[0];
                donationList[0]=newFirstPlace;
                break ;
            }
            // 列表长度>=3，依次和第一名，第二名，第三名比  newFirstPlace  newThirdPlace  newSecondPlace
            if(donationLen>=3){
                if(donationAmount[donationList[donationLen-1]]>donationAmount[donationList[0]]){
                    address newFirstPlace=donationList[donationLen-1];
                    if (donationLen>3)donationList[donationLen-1]=donationList[2];
                    donationList[2]=donationList[1];
                    donationList[1]=donationList[0];
                    donationList[0]=newFirstPlace;
                    break ;
                }
                if(donationAmount[donationList[donationLen-1]]>donationAmount[donationList[1]]){
                    address newSecondPlace=donationList[donationLen-1];
                    if (donationLen>3)donationList[donationLen-1]=donationList[2];
                    donationList[2]=donationList[1];
                    donationList[1]=newSecondPlace;
                    break ;
                }
                if(donationLen==3)break ;
                if(donationAmount[donationList[donationLen-1]]>donationAmount[donationList[2]]){
                    address newThirdPlace=donationList[donationLen-1];
                    donationList[donationLen-1]=donationList[2];
                    donationList[2]=newThirdPlace;
                }

            }

        }

        
        emit DonatedEvent(msg.sender,amountWei,block.timestamp);
        // 执行捐赠
        recipient.transfer(amountWei);


    }

    // 获取前三名列表
    function getTopThreeList()public view returns(address[] memory){
        // 捐赠者列表长度
        uint256 donationLen =donationList.length;
        address[] memory topThreeList = new address[](3);
        for(uint256 i=0;i<3;i++){
            if(i==donationLen)break ;
            topThreeList[i]=donationList[i];
        }

        return topThreeList;
    }


    // 一个 withdraw 函数，允许合约所有者提取所有资金。

    function withdraw(uint256 amountGwei)public isAdmin {
            uint256 contractBalance = address(this).balance;
    require(
        amountGwei > 0 && contractBalance > 0 && amountGwei <= contractBalance,
        "Withdraw: invalid amount (zero or exceeds contract balance)"
    );
        // 执行提取
        payable(owner).transfer(amountGwei);
    }

    // 一个 withdrawAll 函数，允许合约所有者提取所有资金。

    function withdrawAll()public isAdmin  {
        // 余额为0，或者捐赠金额超过余额，检验
        uint256 _balance=address(this).balance;
        require(_balance>0,"Balance Insufficient");

        // 执行提取
        payable(owner).transfer(_balance);
    }

    // 一个 getDonation 函数，允许查询某个地址的捐赠金额。
    function getDonation(address addr)public view  returns (uint256 donateEth){
        return donationAmount[addr];
    }




}