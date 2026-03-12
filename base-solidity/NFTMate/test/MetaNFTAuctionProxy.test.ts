import { expect } from "chai";
import { log } from "console";
import hre from "hardhat";
import { network  } from "hardhat";
import type { Signer } from "ethers";
import { resolve } from "path";


// 连接网络
const { ethers,networkHelpers } =await network.connect();

// 声明需要的变量
// 持续时间
const duration =60;
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
    const auctionV1 = await ethers.deployContract("MetaNFTAuction",[],auctionFactoryAdmin);
    
    // 部署代理合约
    const auctionProxy=await ethers.deployContract("auctionTransparentProxy",[await auctionV1.getAddress()])

    // 拍卖场合约v1绑定上代理合约
    const proxyAsNFTActionV1 = await ethers.getContractAt("MetaNFTAuction", await auctionProxy.getAddress());

    // 执行逻辑合约初始化
    await proxyAsNFTActionV1.connect(auctionFactoryAdmin).initialize(
        auctionFactoryAdmin.address,
        ethfeedaddr,
        usdcfeedaddr,
        usdcFactoryAddr
    );



    // 部署nft工厂合约，获取并默认给seller发送一个代币
    const {newMetaNFT:metaNFT,newNftId:initNftId} =await setMetaNFT(nftFactoryAdmin,seller.address)


    // seller将获得到的nft授权给auction：
    // token全部授权给合约
    // await metaNFT.connect(seller).setApprovalForAll(uupsProxy.target, true)
    // 只授权 【单个指定 NFT】
    await metaNFT.connect(seller).approve(auctionProxy.target, initNftId);

    // 初始化一场拍卖，并记录拍卖场ID号
    const txInitBid= await proxyAsNFTActionV1.start(seller.address,initNftId,metaNFT,startPriceInDollar,duration,[ethFactoryAddr, usdcFactoryAddr]);
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
        // 拍卖场代理合约
        proxyAsNFTActionV1,
        // 拍卖场合约
        auctionProxy,
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
        const {proxyAsNFTActionV1,auctionFactoryAdmin,auctionProxy}=await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);

        const ethPrice= await proxyAsNFTActionV1.connect(auctionFactoryAdmin).getPriceInDollar(1);
        const usdcPrice= await proxyAsNFTActionV1.connect(auctionFactoryAdmin).getPriceInDollar(2);
        console.log("ETH 价格:", ethPrice );
        console.log("USDC 价格:", usdcPrice );
        expect(ethPrice > 0n).to.be.true;
        expect(usdcPrice > 0n).to.be.true;
    });

    it("测试版本号——版本号1",async function(){
        const {auctionProxy} =await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
        const proxyAsNFTAction1 = await ethers.getContractAt("MetaNFTAuction", await auctionProxy.getAddress());

        expect(await proxyAsNFTAction1.getVersion()).to.equal("MetaNFTAuctionV1");
    });

    it("测试版本号——版本号2",async function(){
        const {auctionFactoryAdmin} =await networkHelpers.loadFixture(deployMetaNFTAuctionFixture);
            // 部署拍卖场合约
        const auctionV2 = await ethers.deployContract("MetaNFTAuctionV2",[],auctionFactoryAdmin);
        
        // 部署代理合约
        const auctionProxy=await ethers.deployContract("auctionTransparentProxy",[await auctionV2.getAddress()])

        // 拍卖场合约v2绑定上代理合约
        const proxyAsNFTActionV2 = await ethers.getContractAt("MetaNFTAuctionV2", await auctionProxy.getAddress());

        expect(await proxyAsNFTActionV2.getVersion()).to.equal("MetaNFTAuctionV2");
    });

})

