const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("MetaNodeStake  ", function () {

    let metaNodeStake;
    let metaNodeToken;
    let newPid;
    let PID_INVALID;
    let ETH_PID;
    let PID_VALID;
    let stakeToken;
    let admin;
    let user1, user2;
    let attacker;
    let ZERO_ADDRESS;

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
        // 给用户添加基础质押代币
        await stakeToken.transfer(user1.address, ethers.parseEther("10000"));
        await stakeToken.transfer(user2.address, ethers.parseEther("10000"));
        await stakeToken.connect(admin).transfer(
            user1.address,
            ethers.parseEther("1000")
        );

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

    beforeEach(async function () {
        const fixture = await loadFixture(deployStakeFixture);
        metaNodeStake = fixture.metaNodeStake;
        newPid = await fixture.metaNodeStake.poolLength();
        PID_INVALID = newPid;
        ETH_PID = fixture.ETH_PID;
        PID_VALID = newPid - 1n;
        metaNodeToken = fixture.metaNodeToken;
        stakeToken = fixture.stakeToken;
        admin = fixture.admin;
        user1 = fixture.user1;
        user2 = fixture.user2;
        attacker = fixture.attacker;
        admin = fixture.admin;
        ZERO_ADDRESS = fixture.ZERO_ADDRESS;
    })





    // ==========================================
    // 1. 初始化
    // ==========================================
    describe("initialize ", async function () {
        it("初始化参数正确", async function () {
            const { metaNodeStake } = await loadFixture(deployStakeFixture);
            expect(await metaNodeStake.startBlock()).to.equal(100);
            expect(await metaNodeStake.endBlock()).to.equal(1000000);
        });
    })

    // ==========================================
    // 2. 管理员权限
    // ==========================================
    describe("onlyAdmin  ", function () {


        it("非管理员不能调用管理员方法", async function () {

            await expect(
                metaNodeStake.connect(attacker).addPool(ZERO_ADDRESS, 100, 100, 100, true)
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).setMetaNode(stakeToken)
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).pauseWithdraw()
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).unpauseWithdraw()
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).pauseClaim()
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).unpauseClaim()
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).setStartBlock(100)
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).setEndBlock(100)
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).setMetaNodePerBlock(10000)
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).updatePool(1, 100, 10000)
            ).to.be.reverted;

            await expect(
                metaNodeStake.connect(attacker).setPoolWeight(1, 10, false)
            ).to.be.reverted;

        });

        it("管理员调用管理员方法成功", async function () {

            await expect(
                metaNodeStake.connect(admin).addPool(stakeToken, 100, 100, 100, true)
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).setMetaNode(stakeToken)
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).pauseWithdraw()
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).unpauseWithdraw()
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).pauseClaim()
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).unpauseClaim()
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).setStartBlock(100)
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).setEndBlock(100)
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).setMetaNodePerBlock(10000)
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).updatePool(1, 100, 10000)
            ).not.to.be.reverted;

            await expect(
                metaNodeStake.connect(admin).setPoolWeight(1, 10, false)
            ).not.not.to.be.reverted;

        });

    })



    // =======================================
    // 3. 新增：测试更换奖励代币 setMetaNode
    // ==========================================
    describe("setMetaNode  ", async function () {

        it(" 更换奖励代币成功", async function () {
            const { metaNodeStake, admin } = await loadFixture(deployStakeFixture);

            // 部署新代币
            const NewMetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
            const newMetaNodeToken = await NewMetaNodeToken.connect(admin).deploy();
            const newTokenAddr = await newMetaNodeToken.getAddress();

            // 管理员调用 setMetaNode
            const tx = await metaNodeStake.connect(admin).setMetaNode(newTokenAddr);
            await expect(tx).to.emit(metaNodeStake, "SetMetaNode").withArgs(newTokenAddr)

            // 验证是否修改成功
            const currentToken = await metaNodeStake.MetaNode();
            expect(currentToken).to.equal(newTokenAddr);
        });

    })


    // ==========================================
    // 4. 池子管理
    // ==========================================
    describe("addPool  ", function () {

        it("The first mining pool sent a non-zero address  failed", async function () {

            const MetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
            const metaNodeToken = await MetaNodeToken.deploy();

            const MetaNodeStake = await ethers.getContractFactory("MetaNodeStake");
            metaNodeStake = await MetaNodeStake.deploy();

            const startBlock = 100;
            const endBlock = 1000000;
            const metaNodePerBlock = ethers.parseEther("1");


            await metaNodeStake.initialize(
                metaNodeToken.target,
                startBlock,
                endBlock,
                metaNodePerBlock
            );


            await expect(
                metaNodeStake.addPool(
                    metaNodeToken.target,
                    100,
                    ethers.parseEther("0.01"),
                    100,
                    true
                )
            ).to.be.revertedWith("invalid staking token address");
        });


        it("The first mining pool (ETH pool) has been successfully added, with the address being 0x0", async function () {

            const MetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
            const metaNodeToken = await MetaNodeToken.deploy();

            const MetaNodeStake = await ethers.getContractFactory("MetaNodeStake");
            metaNodeStake = await MetaNodeStake.deploy();

            const startBlock = 100;
            const endBlock = 1000000;
            const metaNodePerBlock = ethers.parseEther("1");

            await metaNodeStake.initialize(
                metaNodeToken.target,
                startBlock,
                endBlock,
                metaNodePerBlock
            );

            const tx = await metaNodeStake.addPool(
                ethers.ZeroAddress,
                100,
                ethers.parseEther("0.01"),
                100,
                true
            );

            await expect(tx)
                .to.emit(metaNodeStake, "AddPool")
                .withArgs(
                    ethers.ZeroAddress,
                    100,
                    100,
                    ethers.parseEther("0.01"),
                    100
                );

            const poolInfo = await metaNodeStake.pool(0);
            expect(poolInfo.stTokenAddress).to.equal(ethers.ZeroAddress);
            expect(poolInfo.poolWeight).to.equal(100);
        });



        it("The second mining pool transmitted the 0 address → failed", async function () {


            await expect(
                metaNodeStake.addPool(
                    ethers.ZeroAddress,
                    200,
                    ethers.parseEther("0.01"),
                    100,
                    true
                )
            ).to.be.revertedWith("invalid staking token address");
        });



        it("The second mining pool (token pool) has been successfully added", async function () {

            const tx = await metaNodeStake.addPool(
                metaNodeToken.target,
                200,
                ethers.parseEther("0.02"),
                150,
                false
            );

            await expect(tx)
                .to.emit(metaNodeStake, "AddPool")
                .withArgs(
                    metaNodeToken.target,
                    200,
                    100,
                    ethers.parseEther("0.02"),
                    150
                );

            const newPool = await metaNodeStake.poolLength() - 1n;

            const poolInfo = await metaNodeStake.pool(newPool);
            expect(poolInfo.stTokenAddress).to.equal(metaNodeToken.target);
        });

        it("Lock block is 0  Failed", async function () {

            await expect(
                metaNodeStake.addPool(
                    metaNodeToken.target,
                    100,
                    ethers.parseEther("0.01"),
                    0, // 错误
                    true
                )
            ).to.be.revertedWith("invalid withdraw locked blocks");
        });

        it("_withUpdate=true successfully ", async function () {

            await metaNodeStake.addPool(
                metaNodeToken.target,
                100,
                ethers.parseEther("0.01"),
                100,
                true // 会更新
            );
            expect(await metaNodeStake.poolLength()).to.equal(3);
        });

        it("Mining has ended , Failed to add pool", async function () {
            const currentBlock = await ethers.provider.getBlockNumber();
            const endBlock = await metaNodeStake.endBlock();
            const blocksToMine = endBlock - BigInt(currentBlock) + 1n;


            // 快进区块超过 endBlock
            await ethers.provider.send("hardhat_mine", [
                (blocksToMine).toString(),
            ]);

            await expect(
                metaNodeStake.addPool(
                    metaNodeToken.target,
                    100,
                    ethers.parseEther("0.01"),
                    100,
                    true
                )
            ).to.be.revertedWith("Already ended");
        });

    })

    describe("updatePool  ", function () {

        it("revert when pid invalid (checkPid)", async function () {
            await expect(metaNodeStake.updatePool(PID_INVALID))
                .to.be.revertedWith("invalid pid");
        });

        it("return early if block.number <= lastRewardBlock", async function () {
            await metaNodeStake.updatePool(PID_VALID);

            const poolAfterFirstCall = await metaNodeStake.pool(PID_VALID);
            const savedLastRewardBlock = poolAfterFirstCall.lastRewardBlock;

            await metaNodeStake.updatePool(PID_VALID);
            const pool = await metaNodeStake.pool(PID_VALID);
            expect(pool.lastRewardBlock).to.equal(savedLastRewardBlock);

        });


        it("update lastRewardBlock only when stSupply == 0", async function () {

            await metaNodeStake.updatePool(PID_VALID);
            const poolbefore = await metaNodeStake.pool(PID_VALID);
            const oldLastRewardBlock = poolbefore.lastRewardBlock;


            await ethers.provider.send("hardhat_mine", ["0x64"]);

            await metaNodeStake.updatePool(PID_VALID);

            const pool = await metaNodeStake.pool(PID_VALID);

            expect(pool.lastRewardBlock).to.be.gt(oldLastRewardBlock);
            expect(pool.accMetaNodePerST).to.equal(0);

        });

        it("full success path: stSupply > 0, no overflow", async function () {

            await metaNodeStake.updatePool(PID_VALID);
            const poolbefore = await metaNodeStake.pool(PID_VALID);
            const oldLastRewardBlock = poolbefore.lastRewardBlock;


            const stakeAmount = ethers.parseEther("100");
            await stakeToken.connect(user1).approve(metaNodeStake.target, stakeAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, stakeAmount);

            await ethers.provider.send("hardhat_mine", ["0x64"]);

            await metaNodeStake.updatePool(PID_VALID);

            const pool = await metaNodeStake.pool(PID_VALID);

            expect(pool.lastRewardBlock).to.be.gt(oldLastRewardBlock);
            expect(pool.accMetaNodePerST).to.be.gt(0);
        });

        it("updatePool should work successfully and emit correct event", async function () {
            await metaNodeStake.updatePool(PID_VALID);
            const stakeAmount = ethers.parseEther("100");
            await stakeToken.connect(user1).approve(metaNodeStake.target, stakeAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, stakeAmount);

            await ethers.provider.send("hardhat_mine", ["100"]);

            const tx = await metaNodeStake.updatePool(PID_VALID);
            const receipt = await tx.wait();

            const events = await metaNodeStake.queryFilter("UpdatePool");

            const evt = events[0];

            const { _pid, lastRewardBlock, totalMetaNode } = evt.args;

            expect(totalMetaNode).to.gt(0);
        });


    })

    describe("updatePool (admin update pool info)", function () {

        it("should update pool config and emit correct event when called by admin", async function () {
            const newMinDeposit = ethers.parseEther("100"); // 最小质押 10
            const newLockBlocks = 1000; // 解锁块 1000

            const tx = await metaNodeStake
                .connect(admin)
                .updatePool(PID_VALID, newMinDeposit, newLockBlocks);
            const receipt = await tx.wait();

            const poolInfo = await metaNodeStake.pool(PID_VALID);
            expect(poolInfo.minDepositAmount).to.equal(newMinDeposit);
            expect(poolInfo.unstakeLockedBlocks).to.equal(newLockBlocks);

            const events = await metaNodeStake.queryFilter("UpdatePoolInfo");
            const evt = events[0];


            expect(evt.args[0]).to.equal(PID_VALID);
            expect(evt.args[1]).to.equal(newMinDeposit);
            expect(evt.args[2]).to.equal(newLockBlocks);
        });

        it("should revert when called by non-admin", async function () {
            const nonAdmin = user1;

            await expect(
                metaNodeStake
                    .connect(nonAdmin)
                    .updatePool(PID_VALID, ethers.parseEther("1"), 100)
            ).to.be.revertedWithCustomError(
                metaNodeStake,
                "AccessControlUnauthorizedAccount"
            );
        });
    });

    describe("setPoolWeight", function () {

        it("should update pool weight with massUpdatePools", async function () {
            const newWeight = 200;

            const tx = await metaNodeStake.connect(admin).setPoolWeight(PID_VALID, newWeight, true);
            await tx.wait();

            const poolInfo = await metaNodeStake.pool(PID_VALID);
            expect(poolInfo.poolWeight).to.equal(newWeight);

            const events = await metaNodeStake.queryFilter("SetPoolWeight");
            const evt = events[0];
            expect(evt.args[0]).to.equal(PID_VALID);
            expect(evt.args[1]).to.equal(newWeight);
            expect(evt.args[2]).to.gt(0);
        });

        it("should update pool weight without massUpdatePools", async function () {
            const newWeight = 300;

            await metaNodeStake.connect(admin).setPoolWeight(PID_VALID, newWeight, false);

            const poolInfo = await metaNodeStake.pool(PID_VALID);
            expect(poolInfo.poolWeight).to.equal(newWeight);
        });

        it("should revert when pool weight is 0", async function () {
            await expect(
                metaNodeStake.connect(admin).setPoolWeight(PID_VALID, 0, true)
            ).to.be.revertedWith("invalid pool weight");
        });

        it("should revert when non-admin calls", async function () {
            await expect(
                metaNodeStake.connect(user1).setPoolWeight(PID_VALID, 200, true)
            ).to.be.revertedWithCustomError(
                metaNodeStake,
                "AccessControlUnauthorizedAccount"
            );
        });
    });

    describe("query poolLength", async function () {
        it("should return correct pool length", async function () {
            const poolLength = await metaNodeStake.poolLength();

            expect(poolLength).to.equal(2);
        });
    })

    describe("getMultiplier", function () {
        async function getPoolParams() {
            const startBlock = await metaNodeStake.startBlock();
            const endBlock = await metaNodeStake.endBlock();
            const metaNodePerBlock = await metaNodeStake.MetaNodePerBlock();
            return { startBlock, endBlock, metaNodePerBlock };
        }

        it("should revert if from > to", async function () {
            await expect(metaNodeStake.getMultiplier(2000, 1000))
                .to.be.revertedWith("invalid block");
        });

        it("should override from to startBlock if from < startBlock", async function () {
            const { startBlock, endBlock, metaNodePerBlock } = await getPoolParams();
            const from = startBlock - 100n;
            const to = startBlock + 1000n;

            const multiplier = await metaNodeStake.getMultiplier(from, to);
            const expected = (to - startBlock) * metaNodePerBlock;

            expect(multiplier).to.equal(expected);
        });

        it("should override from to startBlock if from < startBlock", async function () {
            const { startBlock, endBlock, metaNodePerBlock } = await getPoolParams();

            const from = startBlock - 100n;
            const to = startBlock + 1000n;

            const multiplier = await metaNodeStake.getMultiplier(from, to);
            const expected = (to - startBlock) * metaNodePerBlock;

            expect(multiplier).to.equal(expected);
        });

        it("should override to to endBlock if to > endBlock", async function () {
            const { startBlock, endBlock, metaNodePerBlock } = await getPoolParams();

            const from = startBlock + 100n;
            const to = endBlock + 1000n;

            const multiplier = await metaNodeStake.getMultiplier(from, to);
            const expected = (endBlock - from) * metaNodePerBlock;

            expect(multiplier).to.equal(expected);
        });

        it("should calculate correct multiplier for normal block range", async function () {
            const { startBlock, endBlock, metaNodePerBlock } = await getPoolParams();
            const from = startBlock + 100n;
            const to = endBlock - 100n;

            const multiplier = await metaNodeStake.getMultiplier(from, to);
            const expected = (to - from) * metaNodePerBlock;

            expect(multiplier).to.equal(expected);
        });

        it("should calculate correct multiplier for normal block range", async function () {
            const { startBlock, endBlock, metaNodePerBlock } = await getPoolParams();

            const from = startBlock + 100n;
            const to = endBlock - 100n;

            const multiplier = await metaNodeStake.getMultiplier(from, to);
            const expected = (to - from) * metaNodePerBlock;

            expect(multiplier).to.equal(expected);
        });
    });


    // ==========================================
    // 5. 质押 ETH
    // ==========================================
    describe("depositETH", function () {

        it("should deposit ETH successfully when all conditions are met", async function () {
            const minDeposit = ethers.parseEther("0.001");
            await metaNodeStake
                .connect(admin)
                .updatePool(ETH_PID, minDeposit, 100);

            const depositAmount = ethers.parseEther("0.01");
            const tx = await metaNodeStake
                .connect(user1)
                .depositETH({ value: depositAmount });

            const balance = await ethers.provider.getBalance(metaNodeStake.target);
            expect(balance).to.equal(depositAmount);

            const events = await metaNodeStake.queryFilter("Deposit");
            expect(events.length).to.gt(0);
        });

        it("should revert if deposit amount is less than minDepositAmount", async function () {
            const minDeposit = ethers.parseEther("0.01");
            await metaNodeStake
                .connect(admin)
                .updatePool(ETH_PID, minDeposit, 100);

            const smallAmount = ethers.parseEther("0.0001");
            await expect(
                metaNodeStake.connect(user1).depositETH({ value: smallAmount })
            ).to.be.revertedWith("deposit amount is too small");
        });

    });



    // ==========================================
    // 6. ERC20 质押
    // ==========================================
    describe("deposit (ERC20)", function () {

        it("should deposit ERC20 successfully", async function () {
            const depositAmount = ethers.parseEther("100"); // 大于最小值
            await stakeToken.connect(user1).approve(metaNodeStake.target, depositAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, depositAmount);

            const poolInfo = await metaNodeStake.pool(PID_VALID);
            expect(poolInfo.stTokenAmount).to.equal(depositAmount);
        });

        it("should revert when deposit to ETH pool (pid=0)", async function () {
            await expect(
                metaNodeStake.connect(user1).deposit(0, ethers.parseEther("100"))
            ).to.be.revertedWith("deposit not support ETH staking");
        });

        it("should revert if deposit amount is too small", async function () {
            const poolInfo = await metaNodeStake.pool(PID_VALID);
            const smallAmount = poolInfo.minDepositAmount; // 不满足 > min

            await stakeToken.connect(user1).approve(metaNodeStake.target, smallAmount);

            await expect(
                metaNodeStake.connect(user1).deposit(PID_VALID, smallAmount)
            ).to.be.revertedWith("deposit amount is too small");
        });

        it("should revert with invalid pid", async function () {
            await expect(
                metaNodeStake.connect(user1).deposit(PID_INVALID, ethers.parseEther("100"))
            ).to.be.revertedWith("invalid pid");
        });
    });

    // ==========================================
    // 7. 解质押
    // ==========================================
    describe("unstake", function () {
        const stakeAmount = ethers.parseEther("100");
        const unstakeAmount = ethers.parseEther("50");

        beforeEach(async function () {
            await stakeToken.connect(user1).approve(metaNodeStake.target, stakeAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, stakeAmount);
            await ethers.provider.send("hardhat_mine", ["10"]);
        });


        it("should unstake successfully and create unlock request", async function () {

            await metaNodeStake.connect(user1).unstake(PID_VALID, unstakeAmount);

            const userInfo = await metaNodeStake.user(PID_VALID, user1.address);
            expect(userInfo.stAmount).to.equal(stakeAmount - unstakeAmount);

        });

        it("should revert if insufficient staked balance", async function () {
            const tooMuch = ethers.parseEther("10000");
            await expect(
                metaNodeStake.connect(user1).unstake(PID_VALID, tooMuch)
            ).to.be.revertedWith("Not enough staking token balance");
        });

        it("should revert when withdraw is paused", async function () {
            await metaNodeStake.connect(admin).pauseWithdraw();

            await expect(
                metaNodeStake.connect(user1).unstake(PID_VALID, unstakeAmount)
            ).to.be.revertedWith("withdraw is paused");
        });

        it("should revert with invalid pid", async function () {
            await expect(
                metaNodeStake.connect(user1).unstake(PID_INVALID, unstakeAmount)
            ).to.be.revertedWith("invalid pid");
        });

        it("should accumulate pending rewards when there are unclaimed rewards", async function () {

            const depositAmount = ethers.parseEther("100"); // 大于最小值
            await stakeToken.connect(user1).approve(metaNodeStake.target, depositAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, depositAmount);

            await ethers.provider.send("hardhat_mine", ["100"]);

            await metaNodeStake.connect(user1).unstake(PID_VALID, unstakeAmount);

            const userInfo = await metaNodeStake.user(PID_VALID, user1.address);
            expect(userInfo.pendingMetaNode).to.gt(0);
        });

        it("should emit RequestUnstake event", async function () {
            await expect(metaNodeStake.connect(user1).unstake(PID_VALID, unstakeAmount))
                .to.emit(metaNodeStake, "RequestUnstake")
                .withArgs(user1.address, PID_VALID, unstakeAmount);
        });
    });

    // ==========================================
    // 8. 提现
    // ==========================================
    describe("withdraw", function () {
        const stakeAmount = ethers.parseEther("100");
        const unstakeAmount = ethers.parseEther("40");

        beforeEach(async function () {
            await stakeToken.connect(user1).approve(metaNodeStake.target, stakeAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, stakeAmount);

            await metaNodeStake.connect(user1).unstake(PID_VALID, unstakeAmount);
        });

        it("should NOT withdraw if unlock time not reached", async function () {
            const tx = await metaNodeStake.connect(user1).withdraw(PID_VALID);

            await expect(tx)
                .to.emit(metaNodeStake, "Withdraw")
                .withArgs(user1.address, PID_VALID, 0, await ethers.provider.getBlockNumber());

        });

        it("should withdraw successfully when requests are unlocked", async function () {
            const poolInfo = await metaNodeStake.pool(PID_VALID);
            const lockBlocks = poolInfo.unstakeLockedBlocks;

            await ethers.provider.send("hardhat_mine", [(lockBlocks + 10n).toString()]);
            const tx = await metaNodeStake.connect(user1).withdraw(PID_VALID);


            await expect(tx)
                .to.emit(metaNodeStake, "Withdraw")
                .withArgs(user1.address, PID_VALID, unstakeAmount, await ethers.provider.getBlockNumber());
        });

        it("should withdraw multiple unlocked requests at once", async function () {
            await metaNodeStake.connect(user1).unstake(PID_VALID, unstakeAmount);

            const lockBlocks = (await metaNodeStake.pool(PID_VALID)).unstakeLockedBlocks;
            await ethers.provider.send("hardhat_mine", [(lockBlocks + 10n).toString()]);

            const tx = await metaNodeStake.connect(user1).withdraw(PID_VALID);

            await expect(tx)
                .to.emit(metaNodeStake, "Withdraw")
                .withArgs(user1.address, PID_VALID, unstakeAmount * 2n, await ethers.provider.getBlockNumber());
        });

        it("should revert withdraw if withdraw is paused", async function () {
            await metaNodeStake.connect(admin).pauseWithdraw();

            await expect(
                metaNodeStake.connect(user1).withdraw(PID_VALID)
            ).to.be.revertedWith("withdraw is paused");
        });


        it("should revert if pid is invalid", async function () {
            await expect(
                metaNodeStake.connect(user1).withdraw(PID_INVALID)
            ).to.be.revertedWith("invalid pid");
        });

        it("should do nothing when no withdrawable requests", async function () {
            const lockBlocks = (await metaNodeStake.pool(PID_VALID)).unstakeLockedBlocks;
            await ethers.provider.send("hardhat_mine", [(lockBlocks + 10n).toString()]);
            await metaNodeStake.connect(user1).withdraw(PID_VALID);

            const tx = await metaNodeStake.connect(user1).withdraw(PID_VALID);

            const userInfo = await metaNodeStake.user(PID_VALID, user1.address);
            await expect(tx)
                .to.emit(metaNodeStake, "Withdraw")
                .withArgs(
                    user1.address,
                    PID_VALID,
                    0,
                    await ethers.provider.getBlockNumber()
                );
        });
    });

    describe("withdrawAmount", async function () {
        it("should return correct staking balance for user", async function () {
            const stakeAmount = ethers.parseEther("100");
            await stakeToken.connect(user1).approve(metaNodeStake.target, stakeAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, stakeAmount);

            const balance = await metaNodeStake.stakingBalance(PID_VALID, user1.address);

            expect(balance).to.equal(stakeAmount);
        });

        it("should return 0 when user has no stake", async function () {
            const balance = await metaNodeStake.stakingBalance(PID_VALID, user2.address);
            expect(balance).to.equal(0);
        });

        it("should revert when pid is invalid", async function () {
            await expect(
                metaNodeStake.stakingBalance(999, user1.address)
            ).to.be.revertedWith("invalid pid");
        });

    })

    describe("withdrawAmount", function () {

        it("should return (0, 0) when user has no withdraw requests", async () => {
            const [requestAmount, pendingWithdrawAmount] =
                await metaNodeStake.withdrawAmount(PID_VALID, user1.address);

            expect(requestAmount).to.equal(0);
            expect(pendingWithdrawAmount).to.equal(0);
        });

        it("should revert when pid is invalid", async () => {
            await expect(
                metaNodeStake.withdrawAmount(9999, user1.address)
            ).to.be.revertedWith("invalid pid");
        });
    });

    // ==========================================
    // 9. 领取奖励
    // ==========================================
    describe("claim", function () {
        const stakeAmount = ethers.parseEther("100");

        beforeEach(async function () {
            await stakeToken.connect(user1).approve(metaNodeStake.target, stakeAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, stakeAmount);
        });

        it("should claim rewards successfully when there is pending reward", async function () {
            await ethers.provider.send("hardhat_mine", ["100"]);

            await metaNodeStake.updatePool(PID_VALID);


            const tx = await metaNodeStake.connect(user1).claim(PID_VALID);

            const receipt = await tx.wait();
            const events = await metaNodeStake.queryFilter(
                metaNodeStake.filters.Claim(),
                tx.blockNumber,
                tx.blockNumber
            );
            const claimAmount = events[0].args[2];


            expect(claimAmount).to.be.above(0);

            const userInfo = await metaNodeStake.user(PID_VALID, user1.address);
            expect(userInfo.pendingMetaNode).to.equal(0);
        });

        it("should do nothing when no pending rewards", async function () {
            const tx = await metaNodeStake.connect(user1).claim(PID_VALID);

            await expect(tx)
                .to.emit(metaNodeStake, "Claim")
                .withArgs(user1.address, PID_VALID, 0);
        });

        it("should revert if claim is paused", async function () {
            await metaNodeStake.connect(admin).pauseClaim();

            await expect(
                metaNodeStake.connect(user1).claim(PID_VALID)
            ).to.be.revertedWith("claim is paused");
        });

        it("should revert if pid is invalid", async function () {
            await expect(
                metaNodeStake.connect(user1).claim(999)
            ).to.be.revertedWith("invalid pid");
        });
    });

    describe("pendingMetaNodeByBlockNumber", function () {
        const stakeAmount = ethers.parseEther("100");


        beforeEach(async function () {
            await stakeToken.connect(user1).approve(metaNodeStake.target, stakeAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, stakeAmount);
        });

        it("should revert if pid is invalid", async function () {
            await expect(
                metaNodeStake.pendingMetaNodeByBlockNumber(PID_INVALID, user1.address, 100)
            ).to.be.revertedWith("invalid pid");
        });

        it("should return correct reward when blockNumber <= lastRewardBlock", async function () {
            const pool = await metaNodeStake.pool(PID_VALID);
            const currentBlock = await ethers.provider.getBlockNumber();

            const pending = await metaNodeStake.pendingMetaNodeByBlockNumber(
                PID_VALID,
                user1.address,
                currentBlock
            );

            expect(pending).to.gte(0);
        });

        it("should return correct reward when supply is zero", async function () {
            await metaNodeStake.connect(user1).unstake(PID_VALID, stakeAmount);

            const currentBlock = await ethers.provider.getBlockNumber();
            const pending = await metaNodeStake.pendingMetaNodeByBlockNumber(
                PID_VALID,
                user1.address,
                currentBlock + 10
            );

            expect(pending).to.equal(0);
        });

        it("should return correct pending reward when block > lastRewardBlock", async function () {
            await ethers.provider.send("hardhat_mine", ["100"]);

            const currentBlock = await ethers.provider.getBlockNumber();
            const pending = await metaNodeStake.pendingMetaNodeByBlockNumber(
                PID_VALID,
                user1.address,
                currentBlock
            );

            expect(pending).to.be.above(0);
        });
    });

    describe("pendingMetaNode", function () {
        const stakeAmount = ethers.parseEther("100");

        beforeEach(async function () {
            await stakeToken.connect(user1).approve(metaNodeStake.target, stakeAmount);
            await metaNodeStake.connect(user1).deposit(PID_VALID, stakeAmount);
        });

        it("should revert when pid is invalid", async function () {
            await expect(
                metaNodeStake.pendingMetaNode(PID_INVALID, user1.address)
            ).to.be.revertedWith("invalid pid");
        });

        it("should return correct pending reward for current block", async function () {
            await ethers.provider.send("hardhat_mine", ["100"]);

            const pending = await metaNodeStake.pendingMetaNode(
                PID_VALID,
                user1.address
            );

            expect(pending).to.be.above(0);
        });

        it("should return 0 when user has no stake", async function () {
            const pending = await metaNodeStake.pendingMetaNode(
                PID_VALID,
                user2.address
            );

            expect(pending).to.equal(0);
        });
    });

    // ==========================================
    // 10. 暂停/恢复功能
    // ==========================================
    describe("Pause & Unpause Functions (Withdraw & Claim)", function () {

        it("should pause withdraw successfully and emit event", async function () {
            await expect(metaNodeStake.connect(admin).pauseWithdraw())
                .to.emit(metaNodeStake, "PauseWithdraw");

            expect(await metaNodeStake.withdrawPaused()).to.equal(true);
        });

        it("should revert when pause withdraw twice", async function () {
            await metaNodeStake.connect(admin).pauseWithdraw();

            await expect(metaNodeStake.connect(admin).pauseWithdraw())
                .to.be.revertedWith("withdraw has been already paused");
        });

        it("should revert when non-admin calls pauseWithdraw", async function () {
            await expect(metaNodeStake.connect(user1).pauseWithdraw())
                .to.be.revertedWithCustomError(metaNodeStake, "AccessControlUnauthorizedAccount");
        });

        it("should unpause withdraw successfully and emit event", async function () {
            await metaNodeStake.connect(admin).pauseWithdraw();

            await expect(metaNodeStake.connect(admin).unpauseWithdraw())
                .to.emit(metaNodeStake, "UnpauseWithdraw");

            expect(await metaNodeStake.withdrawPaused()).to.equal(false);
        });

        it("should revert when unpause withdraw twice", async function () {
            await metaNodeStake.connect(admin).pauseWithdraw();
            await metaNodeStake.connect(admin).unpauseWithdraw();

            await expect(metaNodeStake.connect(admin).unpauseWithdraw())
                .to.be.revertedWith("withdraw has been already unpaused");
        });

        it("should revert when non-admin calls unpauseWithdraw", async function () {
            await metaNodeStake.connect(admin).pauseWithdraw();

            await expect(metaNodeStake.connect(user1).unpauseWithdraw())
                .to.be.revertedWithCustomError(metaNodeStake, "AccessControlUnauthorizedAccount");
        });

        it("should pause claim successfully and emit event", async function () {
            await expect(metaNodeStake.connect(admin).pauseClaim())
                .to.emit(metaNodeStake, "PauseClaim");

            expect(await metaNodeStake.claimPaused()).to.equal(true);
        });

        it("should revert when pause claim twice", async function () {
            await metaNodeStake.connect(admin).pauseClaim();

            await expect(metaNodeStake.connect(admin).pauseClaim())
                .to.be.revertedWith("claim has been already paused");
        });

        it("should revert when non-admin calls pauseClaim", async function () {
            await expect(metaNodeStake.connect(user1).pauseClaim())
                .to.be.revertedWithCustomError(metaNodeStake, "AccessControlUnauthorizedAccount");
        });

        // ✅ 你新增的 unpauseClaim 完整测试
        it("should unpause claim successfully and emit event", async function () {
            await metaNodeStake.connect(admin).pauseClaim();

            await expect(metaNodeStake.connect(admin).unpauseClaim())
                .to.emit(metaNodeStake, "UnpauseClaim");

            expect(await metaNodeStake.claimPaused()).to.equal(false);
        });

        it("should revert when unpause claim twice", async function () {
            await metaNodeStake.connect(admin).pauseClaim();
            await metaNodeStake.connect(admin).unpauseClaim();

            await expect(metaNodeStake.connect(admin).unpauseClaim())
                .to.be.revertedWith("claim has been already unpaused");
        });

        it("should revert when non-admin calls unpauseClaim", async function () {
            await metaNodeStake.connect(admin).pauseClaim();

            await expect(metaNodeStake.connect(user1).unpauseClaim())
                .to.be.revertedWithCustomError(metaNodeStake, "AccessControlUnauthorizedAccount");
        });
    });

    // ==========================================
    // 11. 管理员修改奖励参数
    // ==========================================
    describe("Admin Configuration Functions", function () {

        it("should set startBlock successfully by admin", async function () {
            const newStartBlock = 1000;
            await expect(metaNodeStake.connect(admin).setStartBlock(newStartBlock))
                .to.emit(metaNodeStake, "SetStartBlock")
                .withArgs(newStartBlock);

            expect(await metaNodeStake.startBlock()).to.equal(newStartBlock);
        });

        it("should revert when set startBlock > endBlock", async function () {
            const currentEndBlock = await metaNodeStake.endBlock();
            const invalidStartBlock = currentEndBlock + 100n;

            await expect(
                metaNodeStake.connect(admin).setStartBlock(invalidStartBlock)
            ).to.be.revertedWith("start block must be smaller than end block");
        });

        it("should revert when non-admin calls setStartBlock", async function () {
            await expect(
                metaNodeStake.connect(user1).setStartBlock(1000)
            ).to.be.revertedWithCustomError(metaNodeStake, "AccessControlUnauthorizedAccount");
        });


        it("should set endBlock successfully by admin", async function () {
            const newEndBlock = 10000;
            await expect(metaNodeStake.connect(admin).setEndBlock(newEndBlock))
                .to.emit(metaNodeStake, "SetEndBlock")
                .withArgs(newEndBlock);

            expect(await metaNodeStake.endBlock()).to.equal(newEndBlock);
        });

        it("should revert when set endBlock < startBlock", async function () {
            const currentStartBlock = await metaNodeStake.startBlock();
            const invalidEndBlock = currentStartBlock - 1n;

            await expect(
                metaNodeStake.connect(admin).setEndBlock(invalidEndBlock)
            ).to.be.revertedWith("start block must be smaller than end block");
        });

        it("should revert when non-admin calls setEndBlock", async function () {
            await expect(
                metaNodeStake.connect(user1).setEndBlock(10000)
            ).to.be.revertedWithCustomError(metaNodeStake, "AccessControlUnauthorizedAccount");
        });


        it("should set MetaNodePerBlock successfully by admin", async function () {
            const newRate = ethers.parseEther("10");
            await expect(metaNodeStake.connect(admin).setMetaNodePerBlock(newRate))
                .to.emit(metaNodeStake, "SetMetaNodePerBlock")
                .withArgs(newRate);

            expect(await metaNodeStake.MetaNodePerBlock()).to.equal(newRate);
        });

        it("should revert when set MetaNodePerBlock = 0", async function () {
            await expect(
                metaNodeStake.connect(admin).setMetaNodePerBlock(0)
            ).to.be.revertedWith("invalid parameter");
        });

        it("should revert when non-admin calls setMetaNodePerBlock", async function () {
            await expect(
                metaNodeStake.connect(user1).setMetaNodePerBlock(ethers.parseEther("10"))
            ).to.be.revertedWithCustomError(metaNodeStake, "AccessControlUnauthorizedAccount");
        });
    });
});