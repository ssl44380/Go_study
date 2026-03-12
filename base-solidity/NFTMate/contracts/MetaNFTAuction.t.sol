// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.28;

// import {Test, console2} from "forge-std/Test.sol";
// import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
// import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


// import {MetaNFTAuction} from "./MetaNFTAuction.sol";
// import {MetaNFT} from "./MetaNFT.sol";
// import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// contract TestUSDC is ERC20 {
//     constructor() ERC20("Test USDC", "USDC") {}
//     function mint(address to,uint256 amount)external{
//         _mint(to, amount * 10 ** decimals());
//     }
//     function decimals() public pure override returns (uint8) {
//         return 6;
//     }
// }



// contract MetaNFTAuctionTest is Test{
//     MetaNFTAuction private auction;
//     MetaNFT private nft ;
//     TestUSDC public testUSDC; 

//     address public admin = address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
//     ProxyAdmin public proxyAdmin;
//     // address private constant USDC_SEPOLIA = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
//     function setUp() public {
//         proxyAdmin = new ProxyAdmin(admin);
//         console2.log("ProxyAdmin deployed at:", address(proxyAdmin));
//         require(address(proxyAdmin) != address(0), "ProxyAdmin deploy fail");
        
//         MetaNFTAuction impl = new MetaNFTAuction();
//         console2.log("Implementation deployed at:", address(impl));
//         require(address(impl) != address(0), "Implementation deploy fail");

//         require(admin != address(0), "Admin is zero address");
//         bytes memory initData = abi.encodeCall(MetaNFTAuction.initialize, (admin));

//         TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(address(impl), address(proxyAdmin), initData);
//         console2.log("Proxy deployed at:", address(proxy));
//         require(address(proxy) != address(0), "Proxy deploy fail");

//         auction = MetaNFTAuction(address(proxy));
//         console2.log("Auction proxy admin:", auction.getAdmin());  
//         require(auction.getAdmin() == admin, "Auction initialize fail");

//         nft = new MetaNFT();
//         testUSDC = new TestUSDC();  
//         console2.log("NFT deployed at:", address(nft));
//         console2.log("TestUSDC deployed at:", address(testUSDC));

//     }

//     function test_AuctionAdmin() public {
//         assertEq(auction.getAdmin(), admin, "Auction admin mismatch");
//     }

//     // 测试版本号
//     function test_getVersion() public{
//         assertEq(auction.getVersion(),"MetaNFTAuctionV1");
//     }
//     // 测试美元换算价格
//     function test_getPriceInDollar()public{
//         uint256 ethPrice = auction.getPriceInDollar(1);
//         uint256 usdcPrice = auction.getPriceInDollar(2);
//         console2.log("ETH to Doller",ethPrice);
//         console2.log("USDC to Doller",ethPrice);
//         assertGt(ethPrice,0);
//         assertGt(usdcPrice,0);
//     }
//     // 测试只初始一次函数
//     function test_initializeOnlyOnce()public{
//         vm.startPrank(admin);
//         vm.expectRevert();
//         auction.initialize(admin);
//         vm.stopPrank();
//     }
//     // 测试只有管理员可以开始开始拍卖
//     function test_startOnlyAdmin()public{
//         address seller = address(0xB0B);
//         vm.startPrank(seller);
//         vm.expectRevert("not admin");
//         IERC20 usdc = IERC20(testUSDC);
//         auction.start(seller, 1, address(nft), 1000, 3600, address(usdc));
//     }

//     // 测试拍卖品编号自增
//     function test_startIncrementsAuctionId()public{
//         IERC20 usdc=IERC20(testUSDC);
//         address seller=address(0xB0B);
//         assertEq(auction.getAdmin(), admin,"not admin");
//         vm.startPrank(admin);
//         auction.start(seller, 1, address(nft), 1000, 3600, address(usdc));
//         assertEq(auction.auctionId(), 1);
//         auction.start(seller, 1, address(nft), 1000, 3600, address(usdc));
//         assertEq(auction.auctionId(),2);
//     }
//     // 测试超过拍卖时间
//     function test_startAuctionGtDuration() public {
//         IERC20 usdc=IERC20(testUSDC);
//         address seller=address(0xB0B);
//         vm.startPrank(admin);
//         auction.start(seller, 1, address(nft), 1000, 30, address(usdc));
//         vm.stopPrank();
//         uint256 currentAuctionId=auction.auctionId()-1;
//         (,,,, uint256 startTime,,, uint256 duration,,,) = auction.auctions(currentAuctionId);
//         vm.deal(seller, 1 ether);
//         vm.warp(block.timestamp+50+1800);
//         console2.log("current time", block.timestamp);
//         console2.log("startTime", startTime);
//         console2.log("duration", duration);
//         vm.startPrank(seller);
//         vm.expectRevert("Auction expired");
//         auction.bid(1);
//     }

//     // 测试参与拍卖价格少于当前最高价
//     function test_lowerhighestPrice()public{
//         // IERC20 usdc =IERC20(USDC_SEPOLIA);
//         address seller=address(0xB0B);
//         vm.startPrank(admin);
//         auction.start(seller, 1, address(nft), 1000 * 10**8, 30, address(testUSDC));
//         uint256 currentAuctionId=auction.auctionId()-1;
//         vm.stopPrank();
        
        
//         address bidder = address(0xB0BB);
//         vm.deal(bidder, 1 ether);
//         vm.startPrank(bidder);
//         vm.expectRevert("bid too low");
//         auction.bid{value:0.3 ether}(currentAuctionId);
//         vm.stopPrank();

//         vm.startPrank(bidder);
//         auction.bid{value:0.4 ether}(currentAuctionId);
//         (,,,,,,,,,uint256 highestBidInDollar,) = auction.auctions(currentAuctionId);
//         assertEq(highestBidInDollar, 1200* 10**8, "highestBidInDollar update fail");
//         vm.stopPrank();
//     }
//     // 测试拍卖结束，卖家拿拍卖款，买家拿nft
//     function test_bidendtAndwithdraw()public{
//     IERC20 usdc=IERC20(testUSDC);
//     address seller=address(0xB0B);

//     address nftOwner = nft.owner();  
//     console2.log("MetaNFT owner:", nftOwner);
    
//     vm.prank(nftOwner);  
//     uint256 mintedTokenId = nft.mint(seller);  
//     console2.log("Minted NFT ID:", mintedTokenId);  
//     require(mintedTokenId == 1, "NFT minted with wrong ID");  
//     vm.stopPrank();

//     vm.deal(seller,1 ether);
//     vm.startPrank(admin);
//     auction.start(seller,  1, address(nft), 1000 * 10**8, 30, address(usdc));  
//     uint256 currentAuctionId=auction.auctionId()-1;
//     vm.stopPrank();

//     require(nft.ownerOf(1) == seller, "Seller is not NFT owner");

//     vm.startPrank(seller);
//     nft.approve(address(auction), 1);  
//     vm.stopPrank();


//     address bider1=address(0xB0B1);
//     uint256 bidAmount1 = 3 ether;
//     vm.deal(bider1,bidAmount1);
//     vm.startPrank(bider1);
//     auction.bid{value:0.4 ether}(currentAuctionId);
//     vm.stopPrank();
//     uint256 newbider1Balance = bider1.balance;
//     console2.log("bider1 new balance:",newbider1Balance);

//     address bider2=address(0xB0B2);
//     uint256 bidAmount2 = 3 ether;
//     vm.deal(bider2,bidAmount2);
//     vm.startPrank(bider2);
//     auction.bid{value:bidAmount2}(currentAuctionId);
//     vm.stopPrank();

//     vm.warp(block.timestamp+50+1800);
//     vm.startPrank(admin);
//     auction.end(currentAuctionId);
//     vm.stopPrank();

//     uint256 sellerFinalBalance = seller.balance;
//     console2.log("seller new balance:",sellerFinalBalance);
//     assertGe(sellerFinalBalance, bidAmount2, "Seller did not receive bid ");

//     address nftNewOwner = nft.ownerOf(1);
//     console2.log("NFT new home address:", nftNewOwner);
//     assertEq(nftNewOwner, bider2, "NFT not transferred to highest bidder");


//     vm.startPrank(bider1);
//     uint256 bider1BeforeWithdraw = bider1.balance;


//     auction.withdraw(currentAuctionId);  
//     uint256 bider1AfterWithdraw = bider1.balance;
//     vm.stopPrank();

//     assertEq(bider1AfterWithdraw,  bidAmount1, "bider1 withdraw failed");
//     console2.log("bider1 final balance:", bider1AfterWithdraw);


//     vm.startPrank(bider2);
//     vm.expectRevert("zero balance");  
//     auction.withdraw(currentAuctionId);
//     vm.stopPrank();

//     }

// }

