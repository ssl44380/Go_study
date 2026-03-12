import { expect } from "chai";
import { network } from "hardhat";


// 连接网络
const { ethers,networkHelpers } = await network.connect();


// 定义Fixture函数
async function deployMetaNFTFixture(){
	const [owner,addr1] = await ethers.getSigners();
	const metaNFT =await ethers.deployContract("MetaNFT");
    return {metaNFT,owner,addr1};

}





describe("MetaNFT", function () {
    it("should not allow non-owner to mint",async function(){
        const {metaNFT, addr1}= await networkHelpers.loadFixture(deployMetaNFTFixture);
        // 非管理员调用生产代币，报错非管理员
        await expect(metaNFT.connect(addr1).mint(addr1.address)
    ).to.be.revert(ethers);
    });

    it("should allow owner to mint",async function(){
        const {metaNFT, addr1}= await networkHelpers.loadFixture(deployMetaNFTFixture);
        // 管理员调用生产代币，执行成功
        await expect(metaNFT.mint(addr1.address)
    ).not.to.be.revert(ethers);

    });

	it("should return correct owner", async function () {
		const { metaNFT, owner, addr1 } = await networkHelpers.loadFixture(deployMetaNFTFixture);
        // 给addr1生产一个代币
        const tx  =await metaNFT.connect(owner).mint(addr1.address);
        await tx.wait();
        const currentId = await metaNFT.nftId();
        const tokenId=currentId-1n;
        // 查询代币1的归属者
        const currentOwner = await metaNFT.ownerOf(tokenId);
        // 验证归属者就是addr1
        await expect(currentOwner).to.equal(addr1.address);

	});

    it("should allow owner to burn", async function () {
		const {metaNFT, addr1:user1}= await networkHelpers.loadFixture(deployMetaNFTFixture);
        // 给addr1生产一个代币
        const tx  =await metaNFT.mint(user1.address);
        await tx.wait();
        const currentId = await metaNFT.nftId();
        const tokenId=currentId-1n;
        await expect(metaNFT.mint(user1.address)).not.to.be.revert(ethers);
        // 使用addr1销毁代币
        await expect(metaNFT.connect(user1).burn(tokenId)).not.to.be.revert(ethers);

	});

    it("should not allow others to burn", async function () {
		const {metaNFT,owner,addr1}= await networkHelpers.loadFixture(deployMetaNFTFixture);
        // 给addr1生产一个代币
        const tx  =await metaNFT.mint(addr1.address);
        await tx.wait();
        const currentId = await metaNFT.nftId();
        const tokenId=currentId-1n;
        await expect(metaNFT.mint(addr1.address)).not.to.be.revert(ethers);
        // 使用非代币1所有者或授权者账户销毁代币，执行失败
        await expect(metaNFT.connect(owner).burn(tokenId)).to.be.revertedWith("not owner");

	});

});


