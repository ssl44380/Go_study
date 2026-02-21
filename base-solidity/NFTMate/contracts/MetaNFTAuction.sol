// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";


// 创建一个拍卖场，利用初始化函数替代构造函数
contract MetaNFTAuction is Initializable{
    // 创建管理员
    address   admin;
    uint256 public auctionId;//拍卖品id
    bool public isTestnet;
    // 创建拍卖实例
    struct Auction{
        // NFT相关信息
        bool isEnded; //是否结束拍卖
        IERC721 nft; //将nft初始化为标准ierc721接口
        uint256 nftId; //nft的id号
        // 拍卖信息
        address payable seller; //卖家地址
        uint256 startTime;//开始时间
        address highestBidder;//最高竞价
        uint256 startPriceInDollar;//开始时美元价格
        uint256 duration;//持续时间
        uint256 highestBid;//竞价
        uint256 highestBidInDollar;//最高竞价美元价格
        IERC20 paymentToken;//ierc20支付接口
    }
    // 设置拍卖品mapping
    mapping(uint256 =>mapping(address => uint256)) public bids; //拍卖品编号-卖家出款地址-累计出款金额
    mapping (uint256 =>mapping(address=>uint256 )) public bidMethods;  //拍卖品编号-卖家出款地址-卖家出价方式  0：第一次报价 1：eth 2：代币
    mapping (uint256=>Auction) public auctions;//拍卖品信息
    mapping(address => bool) public allowedPaymentTokens;

    
    // 设置结束时间保护期
    uint256 public constant SNIPING_PROTECTION = 1800; 

    // 事件
    event StartBid(uint256 staringBid);
    event Bid(address indexed sender,uint256 auctionId,uint256 amount ,uint256 bidMethod);
    event Withdraw(address indexed  bidder ,uint256 amount);
    event EndBid(uint256 indexed auctionId);

    // 设置权限
    modifier onlyAdmin(){
        require(msg.sender==admin,"not admin");
        _;
    }
    // 初始化
    constructor(){
        _disableInitializers();
    }
    function initialize(address admin_, bool _isTestnet)external initializer{
        if (admin_ == address(0)) revert("Admin cannot be zero");
        admin =admin_;
        auctionId = 0;
        isTestnet = _isTestnet;

    }

    function addAllowedPaymentToken(address token) external {
    // 确保只有管理员能添加
    require(msg.sender == admin, "not admin");
    allowedPaymentTokens[token] = true;
    }
    // 拍卖开始
    function start(
        address seller,
        uint256 nftId,
        address nft,
        uint256 startPriceInDollar,
        uint256 duration,
        address paymentToken

    )external  onlyAdmin{
        require(nft != address(0),"invalid nft");
        require(duration>=30,"invalid duration");
        // require(paymentToken!=address(0),"invalid payment token");
        auctions[auctionId]=Auction({
            isEnded: false,
            nft: IERC721(nft),
            nftId: nftId,
            seller: payable(seller),
            startTime: block.timestamp,
            startPriceInDollar: startPriceInDollar  ,
            duration: duration,
            paymentToken: IERC20(paymentToken),
            highestBid: 0,
            highestBidder: address(0),
            highestBidInDollar: startPriceInDollar
        });
        emit StartBid(auctionId);
        auctionId++;
    }
    // 用户竞价
    function bid(uint256 auctionId_)external payable {
        Auction storage auction=auctions[auctionId_];
        require(!auction.isEnded, "Auction ended");
        require(block.timestamp<auction.startTime+auction.duration,"Auction expired");
        uint256 originalEndTime = auction.startTime + auction.duration;
        if (block.timestamp+SNIPING_PROTECTION>originalEndTime){
            auction.duration+=SNIPING_PROTECTION;
        }
        uint256 allowance = IERC20(auction.paymentToken).allowance(msg.sender, address(this));
        require(msg.value > 0 || allowance > 0, "invalid bid");
        require((msg.value > 0) != (allowance > 0), "only one of ETH or token");

        uint256 bidMethod;
        if (msg.value > 0) {
            bidMethod = 1; // ETH支付
        } else {
            bidMethod = 2; // 代币支付
        }

        if (bidMethods[auctionId_][msg.sender] == 0) {
            bidMethods[auctionId_][msg.sender] = bidMethod;
        } else {
            require(bidMethods[auctionId_][msg.sender] == bidMethod, "cannot change payment method");
        }

        if (bidMethod == 1) {
            uint256 price = getPriceInDollar(1);
            uint256 totalEthBid = bids[auctionId_][msg.sender] + msg.value;

            uint256 bidPrice=_toUsd(totalEthBid,18,price);
            require(bidPrice>auction.highestBidInDollar,"bid too low");
            auction.highestBidInDollar=bidPrice;   
            
            auction.highestBid=msg.value;
            auction.highestBidder=msg.sender;

        } else {
            uint256 price = getPriceInDollar(bidMethod);
            uint8 tokenDecimals = IERC20Metadata(address(auction.paymentToken)).decimals();
            uint256 bidPrice=_toUsd(bids[auctionId_][msg.sender]+msg.value,tokenDecimals,price);
            require(bidPrice>=auction.highestBidInDollar,"bid too low");
            auction.highestBidInDollar=bidPrice;             
            auction.highestBid=allowance;
            IERC20(address(auction.paymentToken)).transferFrom(msg.sender, address(this), allowance);
            auction.highestBidder=msg.sender;
            
        }
        bids[auctionId_][auction.highestBidder]=auction.highestBid;
        emit Bid(auction.highestBidder,auctionId_,auction.highestBid,bidMethod);
    }
    // 拍卖结束
    function end(uint256 auctionId_)external onlyAdmin{
        Auction storage auction=auctions[auctionId_];
        // 基础校验：拍卖未结束，已到结束时间
        require(!auction.isEnded,"Auction ended");
        require(block.timestamp>=auction.startTime+auction.duration,"Auction expired");
        // 标记拍卖结束
        auction.isEnded=true;
        // 拍卖结束后，将拍卖品转给最高出价者，将款项转给卖方
        if(auction.highestBidder!=address(0)){
            uint256 amount = auction.highestBid;
            auction.highestBid = 0;
            bids[auctionId_][auction.highestBidder]=0;
            if(bidMethods[auctionId_][auction.highestBidder]==1){
                
                (bool success,)=payable(auction.seller).call{value:amount}("");
                require(success,"ETH withdraw failed"); 

            }else{
                IERC20(address(auction.paymentToken)).transferFrom(address(this), auction.seller, amount);
            }   

            IERC721(auction.nft).transferFrom(auction.seller, auction.highestBidder, auction.nftId); 
            emit Withdraw(auction.highestBidder,auction.nftId);
            emit Withdraw(auction.seller ,amount);
        }else {
            IERC721(auction.nft).transferFrom(auction.seller, auction.seller, auction.nftId);
            emit Withdraw(auction.seller ,auction.nftId);
        }

        emit EndBid(auctionId_);

    }
    // 剩余用户退款
    function withdraw(uint256 auctionId_)external {
        
        uint256 amount=bids[auctionId_][msg.sender];
        require(amount!=0,"zero balance");
        Auction storage auction=auctions[auctionId_];
        // 拍卖结束
        require(auction.isEnded,"Auction not ended");


        // 拍卖结束后，参与拍卖者提现
        bids[auctionId_][msg.sender]==0;
        if(bidMethods[auctionId_][msg.sender]==1){
            
            (bool success,)=payable(msg.sender).call{value:amount}("");
            require(success,"ETH withdraw failed"); 

        }else{
            IERC20(address(auction.paymentToken)).transferFrom(address(this), msg.sender, amount);
        }   

        emit Withdraw(msg.sender ,amount);


    }

    // 获取比价信息

    function getPriceInDollar(uint256 bidMethod)public view returns(uint256){
        if (isTestnet) {
        if (bidMethod == 1) {
            return 3000 * 1e8; // 模拟 ETH/USD 汇率（3000，适配Chainlink的8位小数）
        } else if (bidMethod == 2) {
            return 2000 * 1e8; // 模拟其他汇率
        } else {
            revert("Invalid bid method");
        }
    }

        AggregatorV3Interface priceFeed;
        if(bidMethod==1){
            priceFeed=AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);
        }else if (bidMethod==2){
            priceFeed = AggregatorV3Interface(0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E);
        }else {
            revert("Invalid bid method");
        }
        (
            ,
            int256 price,
            ,
            uint256 updatedAt,
            
        ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid ETH price");
        require(updatedAt > block.timestamp - 3600, "ETH price feed stale");
        return uint256(price);
    }

    function _toUsd(uint256 amount,uint8 decimals,uint256 price )internal pure returns (uint256){
        uint256 amount18=amount * 10 **(18-decimals);
        return (amount18 * price ) /10 **18;
    }

    function getVersion()public pure virtual returns(string memory){
        return "MetaNFTAuctionV1";
    }

    function getAdmin() external view returns (address) {
        return admin;
    }


}