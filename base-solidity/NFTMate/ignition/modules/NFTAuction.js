// ignition/modules/NFTAuction.js (ES Module 格式，适配你的项目)
export default async function (hre) {
  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);

  // 1. 部署 ProxyAdmin
  const ProxyAdmin = await hre.ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
  await proxyAdmin.deployed();
  console.log("ProxyAdmin 部署地址:", proxyAdmin.address);

  // 2. 部署 MetaNFTAuction 实现合约
  const MetaNFTAuction = await hre.ethers.getContractFactory("MetaNFTAuction");
  const auctionImpl = await MetaNFTAuction.deploy();
  await auctionImpl.deployed();
  console.log("MetaNFTAuction_Implementation 部署地址:", auctionImpl.address);

  // 3. 部署代理合约并初始化
  const initData = auctionImpl.interface.encodeFunctionData("initialize", [deployer.address]);
  const TransparentUpgradeableProxy = await hre.ethers.getContractFactory("TransparentUpgradeableProxy");
  const auctionProxy = await TransparentUpgradeableProxy.deploy(
    auctionImpl.address,
    proxyAdmin.address,
    initData
  );
  await auctionProxy.deployed();
  console.log("MetaNFTAuction_Proxy 部署地址:", auctionProxy.address);

  // 4. 部署 MetaNFT
  const MetaNFT = await hre.ethers.getContractFactory("MetaNFT");
  const nft = await MetaNFT.deploy();
  await nft.deployed();
  console.log("MetaNFT 部署地址:", nft.address);

  // Ignition 会自动将这些合约地址写入 deployed_addresses.json
  return {
    proxyAdmin,
    auctionImpl,
    auctionProxy,
    nft,
  };
}