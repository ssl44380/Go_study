import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


// 部署拍卖场合约
const UUPSModule = buildModule("UUPSModule", (m) => {

    // 获取部署者账户
    const deployer = m.getAccount(0); 

    // 获取代理合约管理员账户
    const proxyAccount = m.getAccount(1);
    const proxyAdminOwner=m.getParameter("proxyAdminOwner",proxyAccount);

    // 获取NFT合约管理账户
    const nftAccount = m.getAccount(2);
    const nftFactoryAdmin=m.getParameter("nftFactoryAdmin", nftAccount);


    // 部署nft合约
    const metaNFT= m.contract("MetaNFT",[],{ from: deployer })
    // 转移合约所有权
    m.call(metaNFT, "transferOwnership", [nftFactoryAdmin], { from: deployer });

    // 部署usdc合约
    const usdcFactory= m.contract("MetaUSDC",[],{ from: deployer })

    // 获取喂价地址
    const ethFeed = m.contract("MockV3Aggregator", [8, 2000e8],{
        id:"ethFeed",
    });
    const usdcFeed = m.contract("MockV3Aggregator", [8, 1e8],{
        id: "usdcFeed", 
    });


    // 部署逻辑合约
    const auction= m.contract("MetaNFTAuctionUups",[],{ from: deployer })

    // 初始化函数
    const initializeData = m.encodeFunctionCall(auction, "initialize", [
        deployer,
        ethFeed,
        usdcFeed,
        usdcFactory
    ]);

    // 部署代理合约
    const proxy = m.contract(
        "UUPSProxy", 
        [
        auction,    // 逻辑合约地址
        initializeData  // 初始化调用数据
    ], { from: deployer });

    return { 
        metaNFT,
        usdcFactory,
        proxy ,
        auction
    };

});





export default UUPSModule;