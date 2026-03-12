import { expect } from "chai";
import { log } from "console";
import { network  } from "hardhat";
// const { upgrades } = require("hardhat");
import type { Signer } from "ethers";
import { resolve } from "path";


// 连接网络
const { ethers,networkHelpers } =await network.connect();

// 声明需要的变量
// 持续时间
const duration =100;
// 起拍价
const startPriceInDollar=100;
// 和合约中的实际狙击保护时间保持一致
const SNIPING_PROTECTION=100;


// 定义Fixture函数

async function deployMetaNFTAuctionFixture(){
    // 获取用户和合约管理员信息
	const [auctionFactoryAdmin,nftFactoryAdmin,usdcFactoryAdmin,seller,bidder1,bidder2] = await ethers.getSigners();

    // 部署 Mock 喂价
    const {ethfeedaddr,usdcfeedaddr} =await setFeed();

    // 部署USDC合约
    const usdcFactoryAddr = await ethers.deployContract("MetaUSDC",[],usdcFactoryAdmin);
    const ethFactoryAddr = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    // 部署拍卖场合约
    const auction = await ethers.deployContract("MetaNFTAuction",[],auctionFactoryAdmin);

    // 没有代理合约时，初始化拍卖合约，需要执行的参数
    await auction.connect(auctionFactoryAdmin).initialize(
        auctionFactoryAdmin.address,
        ethfeedaddr,
        usdcfeedaddr,
        usdcFactoryAddr
    );

    // 部署nft工厂合约，获取并默认给seller发送一个代币
    const {newMetaNFT:metaNFT,newNftId:initNftId} =await setMetaNFT(nftFactoryAdmin,seller.address)


    // seller将获得到的nft授权给auction：
    // token全部授权给合约
    // await metaNFT.connect(seller).setApprovalForAll(auction.target, true)
    // 只授权 【单个指定 NFT】
    await metaNFT.connect(seller).approve(auction.target, initNftId);

    // 初始化一场拍卖，并记录拍卖场ID号
    const txInitBid= await auction.start(seller.address,initNftId,metaNFT,startPriceInDollar,duration,[ethFactoryAddr, usdcFactoryAddr]);
    const receipt=await txInitBid.wait();
    // 获取拍卖品ID号
    // as any :类型断言（Type Assertion）作用只有一个：解决 TypeScript 报错！
    // 因为 TS 认为 logs[1] 可能是普通日志，不一定有 args。加了 as any 之后：TS 放弃检查这个变量的类型
    // 你可以 随便访问 .args、.fragment 等任何属性  不会再报红、不会再报错
    const startBidLog = receipt?.logs[1] as any; 
    // ?. 可选链操作符  “有就取，没有就返回 undefined，不崩溃。”
    // ?? 空值合并运算符  “是 null 或 undefined 就用后面的值，否则用前面的值。”
    const initAuctionId = Number(startBidLog?.args?.[0] ?? 0);


    // 设置用户余额
    await setEthBalance(seller.address, "100");
    await setEthBalance(bidder1.address, "100");
    await setEthBalance(bidder2 .address, "100");

    await usdcFactoryAddr.connect(usdcFactoryAdmin).mint(seller.address,ethers.parseUnits("1000", 6))
    await usdcFactoryAddr.connect(usdcFactoryAdmin).mint(bidder1.address,ethers.parseUnits("1000", 6))
    await usdcFactoryAddr.connect(usdcFactoryAdmin).mint(bidder2.address,ethers.parseUnits("1000", 6))

    return {
        // 拍卖场合约
        auction,
        // 拍卖场合约管理员
        auctionFactoryAdmin,
        // 初始化一场开始拍卖ID
        initAuctionId,
        // nft合约
        metaNFT,
        // nft合约管理员
        nftFactoryAdmin,
        // 初始生成一个nftID
        initNftId,
        // usdc代币地址
        usdcFactoryAddr,
        // usdc代币管理员地址
        usdcFactoryAdmin,
        // eth代币地址
        ethFactoryAddr,
        // // eth币管理员地址
        // ethAdminAddr,
        // 拍卖品所有人
        seller,
        // 竞拍人1
        bidder1,
        // 竞拍人2
        bidder2,
        // 狙击保护期
        SNIPING_PROTECTION,
    };

}

async function setFeed(){
    const ethFeed = await ethers.deployContract("MockV3Aggregator",[8, 2000e8]);
    const usdcFeed = await ethers.deployContract("MockV3Aggregator",[8, 1e8]);

    const ethfeedaddr =await ethFeed.getAddress();
    const usdcfeedaddr =await usdcFeed.getAddress();

    return {ethfeedaddr,usdcfeedaddr}
}

// 构造辅助函数，部署nft拍卖合约，生成一个新的nft
async function setMetaNFT(nftFactoryAdmin:Signer,seller:string){
    const newMetaNFT =await ethers.deployContract("MetaNFT",[],nftFactoryAdmin);
    const tx = await newMetaNFT.mint(seller);
    await tx.wait();
    const currentId = await newMetaNFT.nftId();
    const newNftId=currentId-1n;
    return {newMetaNFT,newNftId}
}

// 构造辅助函数，设置用户账户余额
async function setEthBalance(address:string,ethAmount: string){
    const value=ethers.parseEther(ethAmount);
    const hexValue = ethers.toBeHex(value);
    await ethers.provider.send("hardhat_setBalance",[address,hexValue])
}


// 工具函数，监听拍卖事件

function listenEvent(contract: any, filter: any, listenTimes: number) {
  return new Promise<any[]>((resolve) => {
    const result: any[] = [];
    const callback = (event: any) => {
      result.push(event.args);

      // 达到指定次数 → 关闭监听并返回
      if (result.length === listenTimes) {
        contract.off(filter, callback);
        resolve(result);
      }
    };

    // 开始监听
    contract.on(filter, callback);
  });
}


describe("MetaNFTAuction",function(){


    it("获得美元兑换价格",async function(){
        const {auction}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        const ethPrice= await auction.getPriceInDollar(1);
        const usdcPrice= await auction.getPriceInDollar(2);
        console.log("ETH 价格:", ethPrice );
        console.log("USDC 价格:", usdcPrice );
        expect(ethPrice > 0n).to.be.true;
        expect(usdcPrice > 0n).to.be.true;
    });

    it("测试版本号",async function(){
        const {auction} =await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        expect(await auction.getVersion()).to.equal("MetaNFTAuctionV1");
    });

    it("测试再次初始化initialize函数报错:Initializable: contract is already initialized",async function(){
        const {auction,auctionFactoryAdmin,usdcFactoryAddr} =await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        const {ethfeedaddr,usdcfeedaddr} =await setFeed();
        await expect(
            auction.connect(auctionFactoryAdmin).initialize(
            auctionFactoryAdmin.address,
            ethfeedaddr,
            usdcfeedaddr,
            usdcFactoryAddr
        )).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("测试只有管理员可以开始开始拍卖",async function(){
        const {auction,nftFactoryAdmin,auctionFactoryAdmin,seller,usdcFactoryAddr,ethFactoryAddr}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        // 初始化一个新的nft
        const {newMetaNFT:metaNFT,newNftId:initNftId}=await setMetaNFT(nftFactoryAdmin,seller.address);
        // // token全部授权给合约
        // await metaNFT.connect(seller).setApprovalForAll(auction.target, true)
        // 只授权 【单个指定 NFT】
        await metaNFT.connect(seller).approve(auction.target, initNftId);
        await expect(auction.connect(auctionFactoryAdmin).start(seller.address,initNftId,metaNFT,startPriceInDollar,duration,[ethFactoryAddr,usdcFactoryAddr])).not.to.be.rejected;
    });

    it("测试非管理员不能开始拍卖",async function(){
        const {auction,seller,nftFactoryAdmin,ethFactoryAddr,usdcFactoryAddr}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        // 给seller一个新的nft
        const {newMetaNFT:metaNFT,newNftId:initNftId}=await setMetaNFT(nftFactoryAdmin,seller.address);
        // // token全部授权给合约
        // await metaNFT.connect(seller).setApprovalForAll(auction.target, true)
        // 只授权 【单个指定 NFT】
        await metaNFT.connect(seller).approve(auction.target, initNftId);
        await expect(auction.connect(seller).start(seller.address,initNftId,metaNFT,startPriceInDollar,duration,[ethFactoryAddr,usdcFactoryAddr])).to.be.rejectedWith('not admin');
    });

    it("测试拍卖品编号自增",async function(){
        const {auction,nftFactoryAdmin,auctionFactoryAdmin,seller,ethFactoryAddr,usdcFactoryAddr}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        // // token全部授权给合约
        // await metaNFT.connect(seller).setApprovalForAll(auction.target, true)
        // 只授权 【单个指定 NFT】
        const beforeId=await auction.auctionId();
        const {newMetaNFT:metaNFT,newNftId:initNftId}=await setMetaNFT(nftFactoryAdmin,seller.address);
        // 只授权 【单个指定 NFT】
        await metaNFT.connect(seller).approve(auction.target, initNftId);
        await expect(auction.connect(auctionFactoryAdmin).start(seller.address,initNftId,metaNFT,startPriceInDollar,duration,[ethFactoryAddr,usdcFactoryAddr])).not.to.be.rejected;
        const afterId=await auction.auctionId();
        await expect(afterId).to.equal(beforeId+1n);
    });

    // it("测试nft卖家参与竞拍",async function(){
    //     const {auction,initAuctionId,seller}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
    //     // 卖方向拍卖合约出价，报错
    //     const bidPrice = ethers.parseEther("0.2"); 
    //     await expect(auction.connect(seller).bid(initAuctionId,{value:bidPrice})).to.be.revertedWith("Seller cannot bid");
    // });

    it("测试参与竞拍时超过拍卖时间",async function(){
        const {auction,initAuctionId,bidder1}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        const newTime = duration+SNIPING_PROTECTION+1;
        
        // 跳 601 秒
        await ethers.provider.send("evm_increaseTime", [newTime]);
        await ethers.provider.send("evm_mine", []);

        // 出价被拒绝
        await expect(
            auction.connect(bidder1).bid(initAuctionId, {
            value: ethers.parseEther("0.1"),
            })
        ).to.be.rejectedWith("Auction expired");

    });

    it("测试参与拍卖价格少于当前最高价",async function(){
        const {auction,initAuctionId,bidder1}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        // 获取价格，1-eth，2-usdc
        const ethPrice= await auction.getPriceInDollar(1);
        
        // 以eth为例测试，首次出价小于最高价（起拍价）
        // 出价 0.01 ETH
        const newEthBidAmount = ethers.parseEther("0.1");
        // 计算美元
        const ethToUsdValue = await auction._toUsd(
            newEthBidAmount,
            18, //eth 精度 =18 ； 
            ethPrice
        );

        // //usdc 测试用例
        // const usdcPrice= await auction.getPriceInDollar(2);
        // const newbidPrice=5;
        // const newUsdcBidAmount = ethers.parseUnits("5",6);
        // const usdcToUsdValue = await auction._toUsd(
        //     newUsdcBidAmount,     // USDC 数量：ethers.parseUnits("xxx", 6)
        //     6,              // USDC 精度 = 6
        //     usdcPrice       // USDC 链上价格
        // );

        if (Number(ethToUsdValue)<startPriceInDollar){
            await expect(
                auction.connect(bidder1).bid(initAuctionId, {
                value: newEthBidAmount,
                })
            ).not.to.be.rejectedWith("Bid too low");
        }
    });

    // it("测试买家1和买家2竞价，买家1竞价成功，拍卖结束，买家2提取自己花费，买家1再次提取余额失败，nft归属权变为买家1，拍卖款归seller",async function () {

    //     // let eventsPromise: Promise<any> | null = null;
    //     const {auction,initAuctionId,metaNFT,ethFactoryAddr,usdcFactoryAddr,nftFactoryAdmin,auctionFactoryAdmin,seller,bidder1,bidder2}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
    //     // 获取seller初始eth余额
    //     const initSellerEthBalance = ethers.formatEther(await ethers.provider.getBalance(seller.address));

    //     // 获取seller初始usdc余额
    //     const initSellerUsdc = await usdcFactoryAddr.balanceOf(seller.address);
    //     const initSellerUsdcBalance = parseInt(ethers.formatUnits(initSellerUsdc,6));
        
    //     // 建立监听Bid监听过滤器
    //     const BidFilter=auction.filters.Bid(initAuctionId);

    //     // 指定监听三次
    //     const BidPromise = listenEvent(auction, BidFilter, 3); 

    //     // 买家1出价0.1eth，
    //     await auction.connect(bidder1).bid(initAuctionId,{ value: ethers.parseEther("0.1") });
    //     // 买家2出价0.2eth，
    //     await auction.connect(bidder2).bid(initAuctionId,{ value: ethers.parseEther("0.2") });
    //     // 买家1使用usdc执行最小加价，
    //     await usdcFactoryAddr.connect(bidder1).approve(auction.target, ethers.MaxUint256);
    //     await auction.connect(bidder1).bid(initAuctionId);

    //     const BidEvents = await BidPromise;
    //     // 获取打印日志信息最新一次出价
    //     console.log("BidPromise:::::",BidEvents)

    //     // 最高价地址变为买家1地址,测试最高价地址为买家1地址
    //     expect(BidEvents[0][1]).to.be.equal(bidder1.address);

    //     // 最高价地址变为买家2地址,测试最高价地址为买家2地址
    //     expect(BidEvents[1][1]).to.be.equal(bidder2.address);

    //     // 买家1使用usdc执行最小加价，最高价地址重新变为买家1
    //     expect(BidEvents[2][1]).to.equal(bidder1.address);

    //     // 跳转到结束时间
    //     const newTime = duration+SNIPING_PROTECTION+1;
        
    //     // 跳 601 秒
    //     await ethers.provider.send("evm_increaseTime", [newTime]);
    //     await ethers.provider.send("evm_mine", []);

    //     // 启动监听事件
    //     const withdrawFilter = auction.filters.Withdraw(initAuctionId);
        
    //     // 指定监听四次
    //     const withdrawPromise = listenEvent(auction, withdrawFilter, 4); 
        
    //     // 执行交易，预期监听到3次
    //     await auction.connect(auctionFactoryAdmin).end(initAuctionId);
        
    //     // 买家2执行提款操作
    //     await auction.connect(bidder2).withdraw(initAuctionId);
        
    //     // 获取结果
    //     const withdrawEvents = await withdrawPromise;
        
    //     // 结果1：nftToken归属人变为bidder1
    //     await expect(withdrawEvents[0][1]).to.be.equal(bidder1.address);
        
    //     // 结果2：bidder1支付0.1eth将转到seller账户中，seller的eth余额增加0.1eth
    //     expect(withdrawEvents[1][1]).to.be.equal(seller.address);

    //     // 获取现在seller账户下eth余额
    //     const newSellerBalance = ethers.formatEther(await ethers.provider.getBalance(seller.address));
    //     expect(Number(newSellerBalance)).to.be.equal(Number(initSellerEthBalance)+0.1);

    //     // 获取现在seller账户下的usdc余额
    //     const nowSellerUsdc = await usdcFactoryAddr.balanceOf(seller.address);
    //     const nowSellerUsdcBalance = parseInt(ethers.formatUnits(nowSellerUsdc,6));
    //     expect(Number(nowSellerUsdcBalance)).to.be.equal(Number(initSellerUsdcBalance)+201);

    //     // 买家2执行提款操作成功
    //     const realWithdraw =ethers.formatEther(withdrawEvents[3][3]);
    //     expect(Number(realWithdraw)).to.be.equal(0.2);

    //     // 买家1再次执行提款操作失败
    //     await expect(
    //     auction.connect(bidder1).withdraw(initAuctionId)
    //     ).to.be.rejectedWith("ETH && USDC balance zero");

    // });

    it("买家1在拍卖期间执行取款操作", async () => {
        const {auction,initAuctionId,bidder1} =await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        await expect(auction.connect(bidder1).withdraw(initAuctionId)).to.be.rejectedWith("Auction not ended");
    });

})

