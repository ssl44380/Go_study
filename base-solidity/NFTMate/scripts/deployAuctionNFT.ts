import { network } from "hardhat";

// 连接测试网（比如 sepolia）
const { ethers, networkName } = await network.connect();


console.log("========== 开始部署透明代理合约 ==========");

// 获取部署钱包
const [deployer] = await ethers.getSigners();
console.log("部署钱包地址:", deployer.address);



console.log(`Deploying Counter to ${networkName}...`);

// 1. 先部署 逻辑合约（ MetaNFTAuction）
console.log("正在部署逻辑合约V1 MetaNFTAuction...");
const LogicV1 = await ethers.deployContract("MetaNFTAuction");
await LogicV1.waitForDeployment();
const logicV1Addr = await LogicV1.getAddress();
console.log("逻辑合约已部署V1:", logicV1Addr);

console.log("正在部署逻辑合约V2 MetaNFTAuction...");
const LogicV2 = await ethers.deployContract("MetaNFTAuction");
await LogicV2.waitForDeployment();
const logicV2Addr = await LogicV2.getAddress();
console.log("逻辑合约已部署V1:", logicV2Addr);

// 2. 部署你的透明代理合约
console.log("正在部署透明代理合约 auctionTransparentProxy...");
const Proxy = await ethers.getContractFactory("auctionTransparentProxy");
const proxy = await Proxy.deploy(logicV1Addr);  // 传入逻辑地址
await proxy.waitForDeployment();
const proxyAddr = await proxy.getAddress();

console.log("========================================");
console.log("代理合约部署完成 ✅");
console.log("代理地址:", proxyAddr);
console.log("逻辑地址V1:", logicV1Addr);
console.log("逻辑地址V2:", logicV2Addr);
console.log("========================================");