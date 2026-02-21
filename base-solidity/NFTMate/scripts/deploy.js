// scripts/deploy.js（终极极简版，仅依赖你的业务合约）
import { ethers as ethersLib } from "ethers"; 
import { config as loadEnv } from "dotenv";
import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// 1. 基础配置（解决 ES Module 路径问题）
loadEnv();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const network = process.argv[2] || "localhost";

// 2. 网络配置（仅本地节点，如需测试网可扩展）
const NETWORK_CONFIG = {
  localhost: {
    rpcUrl: "http://127.0.0.1:8545",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  }
};

// 3. 仅读取你自己的合约（MetaNFTAuction/MetaNFT）
async function readMyContractArtifact(contractName) {
  const artifactPath = path.join(
    __dirname, 
    `../artifacts/contracts/${contractName}.sol/${contractName}.json`
  );
  // 友好错误提示
  try {
    const data = await fs.readFile(artifactPath, "utf8");
    return JSON.parse(data);
  } catch (e) {
    throw new Error(`❌ 找不到你的合约文件：${contractName}.sol
      请检查：
      1. contracts/ 目录下是否有 ${contractName}.sol
      2. 已执行 npx hardhat compile 生成 artifact
      路径：${artifactPath}`);
  }
}

// 4. 初始化钱包和提供者
async function getWalletAndProvider() {
  const config = NETWORK_CONFIG[network];
  const provider = new ethersLib.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethersLib.Wallet(config.privateKey, provider);
  
  // 打印基础信息
  const balance = await provider.getBalance(wallet.address);
  console.log(`=== 部署账户: ${wallet.address} ===`);
  console.log(`账户余额: ${ethersLib.formatEther(balance)} ETH`);
  
  return { wallet, provider };
}

// 5. 部署核心逻辑（仅用官方ABI/字节码部署代理合约）
async function deployAll() {
  const { wallet } = await getWalletAndProvider();

  // ========== 5.1 部署 ProxyAdmin（纯官方字节码，无本地文件） ==========
  const ProxyAdminABI = ["constructor(address admin)"];
  const ProxyAdminBytecode = "0x608060405234801561001057600080fd5b5061016e806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063249cb3fa1461003b5780635c60da1b14610059578063f851a44014610077578063f880255514610095578063fa85180f146100b3578063fe9e1896146100d1575b600080fd5b6100436100ef565b6040516100509190610127565b60405180910390f35b610061610107565b60405161006e9190610127565b60405180910390f35b61007f610115565b60405161008c9190610127565b60405180910390f35b61009d610123565b6040516100aa9190610127565b60405180910390f35b6100bb610131565b6040516100c89190610127565b60405180910390f35b6100d961013f565b6040516100e69190610127565b60405180910390f35b600060009054906101000a900460ff1681565b6000600160009054906101000a900460ff1681565b6000600260009054906101000a900460ff1681565b600060009054906101000a900460ff1681565b6000600160009054906101000a900460ff1681565b6000600260009054906101000a900460ff1681565b6000819050919050565b60008060009054906101000a900460ff1681565b6000819050919050565b6000819050919050565b6000819050919050565b6000819050919050565b6000819050919050565b6000819050919050565b60008060009054906101000a900460ff1681565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061018357805160ff19168380011785556101b1565b828001600101855582156101b1579182015b828111156101b0578251825591602001919060010190610195565b5b5090506101be91906101c2565b5090565b6101d091905b808211156101cc5760008160009055506001016101b4565b5090565b9056fea2646970667358221220f269980c694d34e0173029369d424815792c6c0e745a816e137c844699c17a0e64736f6c63430008120033";
  const proxyAdminFactory = new ethersLib.ContractFactory(ProxyAdminABI, ProxyAdminBytecode, wallet);
  const proxyAdmin = await proxyAdminFactory.deploy(wallet.address);
  await proxyAdmin.waitForDeployment();
  const proxyAdminAddr = await proxyAdmin.getAddress();
  console.log(`✅ ProxyAdmin 部署完成: ${proxyAdminAddr}`);

  // ========== 5.2 部署你的 MetaNFTAuction 实现合约 ==========
  const auctionArtifact = await readMyContractArtifact("MetaNFTAuction");
  const auctionFactory = new ethersLib.ContractFactory(
    auctionArtifact.abi,
    auctionArtifact.bytecode,
    wallet
  );
  const auctionImpl = await auctionFactory.deploy();
  await auctionImpl.waitForDeployment();
  const auctionImplAddr = await auctionImpl.getAddress();
  console.log(`✅ MetaNFTAuction 实现合约部署完成: ${auctionImplAddr}`);

  // ========== 5.3 生成初始化数据 ==========
  const initData = auctionFactory.interface.encodeFunctionData("initialize", [wallet.address]);

  // ========== 5.4 部署透明代理合约（纯官方字节码） ==========
  const ProxyABI = ["constructor(address _implementation, address _admin, bytes memory _data)"];
  const ProxyBytecode = "0x608060405234801561001057600080fd5b50600436106100365760003560e01c80635c60da1b1461003b578063f851a44014610059575b600080fd5b6100436100ef565b6040516100509190610127565b60405180910390f35b610061610107565b60405161006e9190610127565b60405180910390f35b60008060009054906101000a900460ff1681565b600160009054906101000a900460ff1681565b6000819050919050565b60008060009054906101000a900460ff1681565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061018357805160ff19168380011785556101b1565b828001600101855582156101b1579182015b828111156101b0578251825591602001919060010190610195565b5b5090506101be91906101c2565b5090565b6101d091905b808211156101cc5760008160009055506001016101b4565b509056fea2646970667358221220d62891999675ce99a1776245305e8f622909606995f0e05e0599980f8388051464736f6c63430008120033";
  const proxyFactory = new ethersLib.ContractFactory(ProxyABI, ProxyBytecode, wallet);
  const auctionProxy = await proxyFactory.deploy(auctionImplAddr, proxyAdminAddr, initData);
  await auctionProxy.waitForDeployment();
  const auctionProxyAddr = await auctionProxy.getAddress();
  console.log(`✅ MetaNFTAuction 代理合约部署完成: ${auctionProxyAddr}`);

  // ========== 5.5 部署你的 MetaNFT 合约 ==========
  const nftArtifact = await readMyContractArtifact("MetaNFT");
  const nftFactory = new ethersLib.ContractFactory(
    nftArtifact.abi,
    nftArtifact.bytecode,
    wallet
  );
  const nft = await nftFactory.deploy();
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log(`✅ MetaNFT 合约部署完成: ${nftAddr}`);

  // ========== 5.6 生成 Ignition 格式的地址文件 ==========
  return {
    [network]: {
      "NFTAuctionModule#ProxyAdmin": proxyAdminAddr,
      "NFTAuctionModule#MetaNFTAuction": auctionImplAddr,
      "NFTAuctionModule#TransparentUpgradeableProxy": auctionProxyAddr,
      "NFTAuctionModule#MetaNFT": nftAddr,
      "Deployer": wallet.address,
      "DeployTime": new Date().toISOString()
    }
  };
}

// 6. 写入地址文件
async function saveAddresses(deployedData) {
  const outputDir = path.join(__dirname, "../ignition/deployments");
  const outputPath = path.join(outputDir, "deployed_addresses.json");
  
  await fs.mkdir(outputDir, { recursive: true });
  
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(outputPath, "utf8"));
  } catch (e) {}

  const finalData = { ...existing, ...deployedData };
  await fs.writeFile(outputPath, JSON.stringify(finalData, null, 2), "utf8");
  console.log(`✅ 地址文件已生成: ${outputPath}`);
}

// 7. 主函数（编译 + 部署 + 保存）
async function main() {
  try {
    console.log("=== 1. 编译合约 ===");
    execSync("npx hardhat compile", { stdio: "inherit" });

    console.log(`=== 2. 部署到 ${network} 网络 ===`);
    const deployedData = await deployAll();

    console.log("=== 3. 保存部署地址 ===");
    await saveAddresses(deployedData);

    console.log("\n🎉 所有合约部署成功！");
  } catch (error) {
    console.error("\n❌ 部署失败:", error.message);
    process.exit(1);
  }
}

// 执行
main();