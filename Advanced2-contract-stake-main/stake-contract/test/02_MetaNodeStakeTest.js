const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("MetaNodeStake  ", function () {
	async function deployStakeFixture() {
		const [admin, user1, user2, attacker] = await ethers.getSigners();
		const ETH_PID = 0;
		const ZERO_ADDRESS = ethers.ZeroAddress;

		// 部署真实代币 MetaNodeToken
		const MetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
		const metaNodeToken = await MetaNodeToken.deploy();

		// 测试质押代币
		const TestERC20 = await ethers.getContractFactory("TestERC20");
		const stakeToken = await TestERC20.deploy(
		"StakeToken", "STK", ethers.parseEther("1000000")
		);

		// 部署 UUPS 可升级质押合约
		const MetaNodeStake = await ethers.getContractFactory("MetaNodeStake");
		const startBlock = 100;
		const endBlock = 1000000;
		const metaNodePerBlock = ethers.parseEther("1");

		const metaNodeStake = await upgrades.deployProxy(
		MetaNodeStake,
		[metaNodeToken.target, startBlock, endBlock, metaNodePerBlock],
		{ initializer: "initialize" }
		);

		// 转入奖励代币
		await metaNodeToken.transfer(metaNodeStake.target, ethers.parseEther("1000000"));

		// 添加 ETH 池
		await metaNodeStake.addPool(
		ZERO_ADDRESS, 100, ethers.parseEther("0.01"), 100, true
		);

		// 添加 ERC20 池
		await metaNodeStake.addPool(
		stakeToken.target, 200, ethers.parseEther("10"), 200, true
		);

		return {
		metaNodeStake, metaNodeToken, stakeToken,
		admin, user1, user2, attacker, ETH_PID, ZERO_ADDRESS
		};
	}

	// ==========================================
	// 1. 初始化
	// ==========================================
	it("初始化参数正确", async function () {
		const { metaNodeStake } = await loadFixture(deployStakeFixture);
		expect(await metaNodeStake.startBlock()).to.equal(100);
		expect(await metaNodeStake.endBlock()).to.equal(1000000);
	});

	// ==========================================
	// 2. 管理员权限
	// ==========================================
	it("非管理员不能调用管理员方法", async function () {
		const { metaNodeStake, attacker, ZERO_ADDRESS } = await loadFixture(deployStakeFixture);
		await expect(
		metaNodeStake.connect(attacker).addPool(ZERO_ADDRESS,100,100,100,true)
		).to.be.reverted;
	});

	// ==========================================
	// 3. ✅ 新增：测试更换奖励代币 setMetaNode
	// ==========================================
	it("setMetaNode 更换奖励代币成功", async function () {
		const { metaNodeStake, admin } = await loadFixture(deployStakeFixture);

		// 部署新代币
		const NewMetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
		const newMetaNodeToken = await NewMetaNodeToken.connect(admin).deploy();
		const newTokenAddr = await newMetaNodeToken.getAddress();

		// 管理员调用 setMetaNode
		await metaNodeStake.connect(admin).setMetaNode(newTokenAddr);

		// 验证是否修改成功
		const currentToken = await metaNodeStake.MetaNode();
		expect(currentToken).to.equal(newTokenAddr);
	});

	// ==========================================
	// 4. 池子管理
	// ==========================================
	it("添加池子成功", async function () {
		const { metaNodeStake } = await loadFixture(deployStakeFixture);
		expect(await metaNodeStake.poolLength()).to.equal(2);
	});

	it("修改池子信息成功", async function () {
		const { metaNodeStake } = await loadFixture(deployStakeFixture);
		await metaNodeStake.updatePool(0, ethers.parseEther("0.02"), 150);
	});

	it("修改池子权重成功", async function () {
		const { metaNodeStake } = await loadFixture(deployStakeFixture);
		await metaNodeStake.setPoolWeight(0, 150, true);
	});

	// ==========================================
	// 5. 质押 ETH
	// ==========================================
	it("质押 ETH 成功", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.connect(user1).depositETH({
		value: ethers.parseEther("0.1")
		});
		const bal = await metaNodeStake.stakingBalance(0, user1.address);
		expect(bal).to.equal(ethers.parseEther("0.1"));
	});

	it("质押金额不足失败", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await expect(
		metaNodeStake.connect(user1).depositETH({value: ethers.parseEther("0.001")})
		).to.be.revertedWith("deposit amount is too small");
	});

	// ==========================================
	// 6. ERC20 质押
	// ==========================================
	it("质押 ERC20 成功", async function () {
		const { metaNodeStake, admin, user1, stakeToken } = await loadFixture(deployStakeFixture);
		await stakeToken.connect(admin).transfer(user1.address, ethers.parseEther("100"));
		await stakeToken.connect(user1).approve(metaNodeStake.target, ethers.parseEther("100"));
		await metaNodeStake.connect(user1).deposit(1, ethers.parseEther("100"));
	});

	// ==========================================
	// 7. 解质押
	// ==========================================
	it("申请解质押成功", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.connect(user1).depositETH({value: ethers.parseEther("0.2")});
		await metaNodeStake.connect(user1).unstake(0, ethers.parseEther("0.1"));
		const [req, pending] = await metaNodeStake.withdrawAmount(0, user1.address);
		expect(req).to.equal(ethers.parseEther("0.1"));
	});

	it("解质押超过余额失败", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await expect(
		metaNodeStake.connect(user1).unstake(0, ethers.parseEther("100"))
		).to.be.revertedWith("Not enough staking token balance");
	});

	// ==========================================
	// 8. 提现
	// ==========================================
	it("到期后提现成功", async function () {
	const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.connect(user1).depositETH({value: ethers.parseEther("0.2")});
		await metaNodeStake.connect(user1).unstake(0, ethers.parseEther("0.2"));
		await ethers.provider.send("hardhat_mine", ["0x100"]);
		await expect(metaNodeStake.connect(user1).withdraw(0)).not.to.be.reverted;
	});

	// ==========================================
	// 9. 领取奖励
	// ==========================================
	it("领取奖励成功", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.connect(user1).depositETH({value: ethers.parseEther("1")});
		await ethers.provider.send("hardhat_mine", ["0x64"]);
		await expect(metaNodeStake.connect(user1).claim(0)).not.to.be.reverted;
	});

	it("查询 pending reward 成功", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.connect(user1).depositETH({value: ethers.parseEther("1")});
		await ethers.provider.send("hardhat_mine", ["0x64"]);
		const pending = await metaNodeStake.pendingMetaNode(0, user1.address);
		expect(pending).to.gt(0);
	});

	// ==========================================
	// 10. 暂停/恢复功能
	// ==========================================
	it("暂停提现 → unstake 失败", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.pauseWithdraw();
		await expect(
		metaNodeStake.connect(user1).unstake(0, ethers.parseEther("0.1"))
		).to.be.revertedWith("withdraw is paused");
	});

	it("恢复提现 → 可以 unstake", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.pauseWithdraw();
		await metaNodeStake.unpauseWithdraw();
		await metaNodeStake.connect(user1).depositETH({value: ethers.parseEther("0.2")});
		await expect(
		metaNodeStake.connect(user1).unstake(0, ethers.parseEther("0.1"))
		).not.to.be.reverted;
	});

	it("暂停领取 → claim 失败", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.pauseClaim();
		await expect(
		metaNodeStake.connect(user1).claim(0)
		).to.be.revertedWith("claim is paused");
	});

	it("恢复领取 → 可以 claim", async function () {
		const { metaNodeStake, user1 } = await loadFixture(deployStakeFixture);
		await metaNodeStake.pauseClaim();
		await metaNodeStake.unpauseClaim();
		await expect(
		metaNodeStake.connect(user1).claim(0)
		).not.to.be.reverted;
	});

	// ==========================================
	// 11. 管理员修改奖励参数
	// ==========================================
	it("管理员修改 startBlock", async function () {
		const { metaNodeStake } = await loadFixture(deployStakeFixture);
		await metaNodeStake.setStartBlock(120);
	});

	it("管理员修改 endBlock", async function () {
		const { metaNodeStake } = await loadFixture(deployStakeFixture);
		await metaNodeStake.setEndBlock(999999);
	});

	it("管理员修改 MetaNodePerBlock", async function () {
		const { metaNodeStake } = await loadFixture(deployStakeFixture);
		await metaNodeStake.setMetaNodePerBlock(ethers.parseEther("2"));
	});
});