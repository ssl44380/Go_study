import { network } from "hardhat";

// 连接测试网（比如 sepolia）
const { ethers } = await network.connect({
  network: "sepolia",  // 测试网
  chainType: "l1",
});

console.log("========== 开始部署透明代理合约 ==========");

// 获取部署钱包
const [deployer] = await ethers.getSigners();
console.log("部署钱包地址:", deployer.address);

// 1. 先部署 逻辑合约（ MetaNFTAuction）
console.log("正在部署逻辑合约V1 MetaNFTAuction...");
const LogicV1 = await ethers.getContractFactory("MetaNFTAuction");
const logicV1= await LogicV1.deploy();
await logicV1.waitForDeployment();
const logicV1Addr = await logicV1.getAddress();
console.log("逻辑合约已部署V1:", logicV1Addr);

console.log("正在部署逻辑合约V2 MetaNFTAuction...");
const LogicV2 = await ethers.getContractFactory("MetaNFTAuction");
const logicV2= await LogicV1.deploy();
await logicV2.waitForDeployment();
const logicV2Addr = await logicV1.getAddress();
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