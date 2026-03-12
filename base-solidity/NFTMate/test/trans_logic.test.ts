// import  {loadFixture}  from "@nomicfoundation/hardhat-network-helpers";
// import { expect, use } from "chai";
// import { log } from "console";
// import { network } from "hardhat";


// const { ethers ,networkHelpers} =await network.connect();



// async function deployProxyFixture(){
    
//     const [proxyAdmin,LogicalAdmin,user1] = await ethers.getSigners();

//     const logic1 =await ethers.deployContract("Logic1",[],LogicalAdmin);

//     const logic2 =await ethers.deployContract("Logic2",[],LogicalAdmin);

//     const proxy =await ethers.deployContract("TransparentProxy",[await logic1.getAddress()],proxyAdmin);

//     return {proxy,proxyAdmin,logic1,logic2,user1};
// }

// describe("TransparentProxy",function(){
//     it("调用foo后能读到代理合约的words", async function () {
//         let words
//         const { proxy, proxyAdmin,logic2, user1 } = await loadFixture(deployProxyFixture);

//         // 1. 获取代理绑定的逻辑合约
//         const proxyAsLogic1 = await ethers.getContractAt("Logic1", await proxy.getAddress());

//         // 2. 调用逻辑合约 foo() → 修改代理合约的 words
//         await proxyAsLogic1.connect(user1).foo();

//         // 3. 【同一测试用例中】读取代理合约的 words
//         words = await proxy.connect(user1).words();

//         console.log("words1:::::::::", words);
//         // 输出：words::::::::: old

//         // 执行升级
//         await proxy.connect(proxyAdmin).upgrade(await logic2.getAddress());
//         // 构建新的abi
//         const proxyAsLogic2= await ethers.getContractAt("Logic2",await proxy.getAddress());

//         await proxyAsLogic2.connect(user1).foo();

//         words=await proxy.connect(user1).words();

//         console.log("words2:::::::::", words)
//         // 输出：words::::::::: new
//     });


// })