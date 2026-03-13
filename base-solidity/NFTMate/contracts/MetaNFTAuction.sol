// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// 创建一个拍卖场，利用初始化函数替代构造函数
contract MetaNFTAuction is Initializable{
    // 创建管理员
    address   admin;
    // 设置拍卖ID
    uint256 public auctionId = 1;

    // 存储价格喂价地址
    address public ethUsdFeed;
    address public usdcUsdFeed;
    // eth管理接口地址
    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    // usdc管理接口地址
    address usdcAddr;



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
        uint256 highestBidUSD;//最高竞价美元价格
        address[] paymentTokens;//ierc20支付接口
    }
    // 设置拍卖品mapping
    //拍卖品编号-卖家出款地址-累计出款金额美元计价
    mapping(uint256 =>mapping(address => uint256)) public userUsdAmount; 
     //拍卖品编号-卖家出款地址-卖家出价方式  0：第一次报价 1：eth 2：代币
    mapping (uint256 =>mapping(address=>uint256 )) public bidMethods; 
    // 拍卖ID => 用户 => 支付代币地址 => 该代币总出价（原生数量）
    mapping(uint256 => mapping(address => mapping(address => uint256))) public userTokenAmount;
    //拍卖品信息
    mapping(address => bool) public allowedPaymentTokens;
    mapping (uint256=>Auction) public auctions;

    
    // 设置结束时间保护期
    uint256 public constant SNIPING_PROTECTION = 100; 

    // 事件
    event StartBid(uint256 staringBid);
    event Bid(uint256 indexed auctionId,address indexed bidder,uint256 amount);
    // 提取金额paymentMode：0-nft,1-eth,2-usdc
    event Withdraw(uint256 indexed auctionId,address indexed  bidder,uint256 paymentMode ,uint256 amount);
    event EndBid(uint256 indexed auctionId);

    // 设置权限
    modifier onlyAdmin(){
        require(msg.sender==admin,"not admin");
        _;
    }

    // 初始化
    function initialize(address admin_ ,address ethUsdFeed_, address usdcUsdFeed_,address usdcaddr_)external initializer{

        if (admin_ == address(0)) revert("Admin cannot be zero");
        admin =admin_;
        ethUsdFeed = ethUsdFeed_;
        usdcUsdFeed = usdcUsdFeed_;
        usdcAddr = usdcaddr_;
    }

    // 升级函数

    // function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {}

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
        address[] calldata paymentTokens

    )external  onlyAdmin returns(uint256){
        // 1.执行CHECKS校验
        require(seller != address(0), "invalid seller");
        require(nft != address(0), "invalid nft");
        require(duration >= 30, "duration >=30");
        require(startPriceInDollar > 0, "invalid price");
        require(paymentTokens.length > 0, "no payment tokens");
        // 初始化NFT合约
        IERC721 nftContract = IERC721(nft);

        // 校验NFT归属
        require(nftContract.ownerOf(nftId) == seller, "not owner");
            // 校验授权
        require(
            nftContract.isApprovedForAll(seller, address(this)) ||
            nftContract.getApproved(nftId) == address(this),
            "not approved"
        );

        // 2.INTERACTIONS 转账NFT
        nftContract.transferFrom(seller, address(this), nftId);

        auctions[auctionId]=Auction({
            isEnded: false,
            nft: nftContract,
            nftId: nftId,
            seller: payable(seller),
            startTime: block.timestamp,
            startPriceInDollar: startPriceInDollar  ,
            duration: duration,
            paymentTokens: paymentTokens,
            highestBid: 0,
            highestBidder: address(0),
            highestBidUSD: startPriceInDollar
        });
        // 记录开始拍卖事件
        emit StartBid(auctionId);
        // 记录本次拍卖事件编号
        uint256 newAuctionId = auctionId;
        // 拍卖事件自增1
        auctionId++;
        // 返回本次拍卖事件编号
        return newAuctionId;
    }

    // 用户竞价
    function bid(uint256 auctionId_)external payable {
        Auction storage auction=auctions[auctionId_];

        // 检查
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(!auction.isEnded, "Auction ended");

        
        // 区块时间<=开始时间加+持续时间
        uint256 endTime = auction.startTime + auction.duration;
        require(block.timestamp < endTime, "Auction expired");

        // 自动识别代币
        address paymentToken = msg.value > 0 ? NATIVE_TOKEN : usdcAddr;
        require(_isPaymentTokenSupported(auctionId_, paymentToken), "Payment token not supported");

        // 防止被狙击：最后 N 秒自动延长时间
        if (block.timestamp + SNIPING_PROTECTION > endTime) {
            auction.duration += SNIPING_PROTECTION;
        }

        // 读取关键数据
        uint256 highestBidUSD = auction.highestBidUSD;
        uint256 minBidUSD = highestBidUSD + 1;
        uint256 userOldUsd = userUsdAmount[auctionId_][msg.sender];

        if (paymentToken == NATIVE_TOKEN) {
            require(msg.value > 0, "ETH must be sent");
            
            uint256 ethPrice = getPriceInDollar(1);
            uint256 newEthToUsd = _toUsd(msg.value, 18, ethPrice);
            uint256 newUsd = userOldUsd + newEthToUsd;

            require(newUsd > minBidUSD, "Bid too low");

            // EFFECTS：先修改状态（安全）
            userUsdAmount[auctionId_][msg.sender] = newUsd;
            userTokenAmount[auctionId_][msg.sender][NATIVE_TOKEN] += msg.value;
            auction.highestBidUSD = newUsd;
        }else {
            uint256 needUsd = minBidUSD - userOldUsd;
            uint256 needUsdc = _usdToToken(paymentToken, needUsd, 1e8, 6) ;
            uint256 transferUsdcAmount = needUsdc * 1e6;
            IERC20 token = IERC20(paymentToken);
            require(token.allowance(msg.sender, address(this)) >= needUsdc, "Allowance too low");
            
            // INTERACTIONS：转账
            token.transferFrom(msg.sender, address(this), transferUsdcAmount);

            // EFFECTS：更新状态
            userUsdAmount[auctionId_][msg.sender] = minBidUSD;
            userTokenAmount[auctionId_][msg.sender][paymentToken] += transferUsdcAmount;
            auction.highestBidUSD = minBidUSD;
        }
        auction.highestBidder = msg.sender;
        emit Bid(auctionId_, msg.sender, auction.highestBidUSD);
    }

    // 拍卖结束
    function end(uint256 auctionId_)external onlyAdmin{
        Auction storage auction=auctions[auctionId_];
        // 基础校验：拍卖未结束，已到结束时间
        require(!auction.isEnded,"Auction ended");
        require(block.timestamp>=auction.startTime+auction.duration,"Auction not expired");
        // 标记拍卖结束
        auction.isEnded=true;
        // 获取拍卖信息
        address seller = auction.seller;
        address winner = auction.highestBidder;
        uint256 nftId = auction.nftId;
        IERC721 nft = auction.nft;
        // 拍卖结束后：
        // 1、如果无人竞拍，将拍卖品转给卖家
        // 2、如果将拍卖品转给最高出价者，将款项转给卖方
        if(winner==address(0)){
                auction.nft.transferFrom(address(this), seller, nftId);
                emit Withdraw(auctionId_,seller,1,nftId);
        }else{
            // 将nft转给最高价地址
            nft.transferFrom(address(this), winner, nftId);
            emit Withdraw(auctionId_,winner,0,nftId);
            // 将买方支付的eth和usdc转移给卖方
            // 查询余额
            uint256 payEth=userTokenAmount[auctionId_][winner][NATIVE_TOKEN];
            uint256 payUsdc=userTokenAmount[auctionId_][winner][usdcAddr];
            // 清零余额记录数据
            userTokenAmount[auctionId_][winner][NATIVE_TOKEN] = 0;
            userTokenAmount[auctionId_][winner][usdcAddr] = 0; 
            if (payEth > 0) {
                // 查余额大于等于支付额度
                require(address(this).balance >= payEth, "Insufficient ETH in contract");
                // 执行转账
                (bool success, ) = seller.call{value: payEth}("");
                require(success, "ETH transfer failed");
                // 记录提取事件
                emit Withdraw(auctionId_,seller,1,payEth);
            }
            if (payUsdc > 0) {
            require(IERC20(usdcAddr).balanceOf(address(this)) >= payUsdc, "Insufficient USDC");
            bool usdcSuccess = IERC20(usdcAddr).transfer(seller, payUsdc);
            require(usdcSuccess, "USDC transfer failed");
            emit Withdraw(auctionId_,seller,2,payUsdc);
            }
        }

        emit EndBid(auctionId_);

    }
    // 剩余用户退款
    function withdraw(uint256 auctionId_)external {
        Auction storage auction=auctions[auctionId_];
        // 拍卖结束
        require(auction.isEnded,"Auction not ended");
        uint256 payEth=userTokenAmount[auctionId_][msg.sender][NATIVE_TOKEN];
        uint256 payUsdc=userTokenAmount[auctionId_][msg.sender][usdcAddr];
        require(!(payEth == 0 && payUsdc ==0),"ETH && USDC balance zero");
        userTokenAmount[auctionId_][msg.sender][NATIVE_TOKEN] = 0;
        userTokenAmount[auctionId_][msg.sender][usdcAddr] = 0;
        if (payEth > 0) {
            require(address(this).balance >= payEth, "Insufficient ETH in contract");
            (bool success, ) = msg.sender.call{value: payEth}("");
            require(success, "ETH transfer failed");
            emit Withdraw(auctionId_,msg.sender,1,payEth);
        }
        if (payUsdc > 0) {
            require(IERC20(usdcAddr).balanceOf(address(this)) >= payUsdc, "Insufficient USDC");
            bool usdcSuccess = IERC20(usdcAddr).transfer(msg.sender, payUsdc);
            require(usdcSuccess, "USDC transfer failed");
            emit Withdraw(auctionId_,msg.sender,2,payUsdc);
        }
    }

    // 检查拍卖是否支持该支付方式（ETH 或 USDC）
    function _isPaymentTokenSupported(uint256 auctionId_, address paymentToken) internal view returns (bool) {
        Auction storage auction = auctions[auctionId_];
        address[] memory supportedTokens = auction.paymentTokens;
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == paymentToken) {
                return true;
            }
        }
        return false;
    }

    // 获取美元兑换比例信息

    function getPriceInDollar(uint256 bidMethod) public view returns (uint256) {
        AggregatorV3Interface priceFeed;

        if (bidMethod == 1) {
            priceFeed = AggregatorV3Interface(ethUsdFeed);
        } else if (bidMethod == 2) {
            priceFeed = AggregatorV3Interface(usdcUsdFeed);
        } else {
            revert("Invalid bid method");
        }

        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");

        return uint256(price);
    }

    function _toUsd(uint256 amount,uint8 decimals,uint256 price )public pure returns (uint256){
        // uint256 amount18=amount * 10 **(18-decimals);
        // return (amount18 * price ) /10 **8;
         return (amount * price) / (10 ** decimals) / 1e8;
    }

    function _usdToToken(
        address token,
        uint256 usdAmount,
        uint256 price,
        uint8 decimals
    ) internal pure returns (uint256) {
        if (token == NATIVE_TOKEN) {
            return (usdAmount * (10 ** decimals)) / price;
        } else {
            // ✅ USDC 1:1 正确转换
            return usdAmount;
        }
    }

    function getVersion()public pure virtual returns(string memory){
        return "MetaNFTAuctionV1";
    }

    function getAdmin() external view returns (address) {
        return admin;
    }


}