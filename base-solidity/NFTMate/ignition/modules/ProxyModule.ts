import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


// 部署拍卖场合约
const proxyModule = buildModule("ProxyModules", (m) => {

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

    // 部署逻辑合约
    const auction= m.contract("MetaNFTAuction",[],{ from: deployer })
    // 获取喂价地址
    const ethFeed = m.contract("MockV3Aggregator", [8, 2000e8],{
        id:"ethFeed",
    });
    const usdcFeed = m.contract("MockV3Aggregator", [8, 1e8],{
        id: "usdcFeed", 
    });

    // 初始化函数
    const initializeData = m.encodeFunctionCall(auction, "initialize", [
        deployer,
        ethFeed,
        usdcFeed,
        usdcFactory
    ]);


    // 部署代理合约
    const proxy=m.contract("TransparentUpgradeableProxy",[
        auction,
        proxyAdminOwner,
        initializeData,
    ])

    // 拿到代理合约的管理员合约
    const proxyAdminAddress=m.readEventArgument(
        proxy,
        "AdminChanged",
        "newAdmin",
    )

    // 获取代理合约的管理员合约地址
    const proxyAdmin=m.contractAt("ProxyAdmin",proxyAdminAddress);



    return { 
        metaNFT,
        usdcFactory,
        proxyAdmin, 
        proxy 
    };

});


export default buildModule("nftAuctionModule", (m) => {

    // 读取
    const {metaNFT,usdcFactory,proxy, proxyAdmin } = m.useModule(proxyModule);

    const auction = m.contractAt("MetaNFTAuction", proxy);



    return {
        auction,
        metaNFT,
        usdcFactory,
        proxy, 
        proxyAdmin
    }

});


