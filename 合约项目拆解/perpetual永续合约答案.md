# MetaNode 永续合约项目测试题 — 完整参考答案

------



| 维度           | 本项目（链下撮合 + 链上重算）                                | AMM（PvP 资金池）             | 纯链上订单簿                    | ZKP 订单簿                               |
| :------------- | :----------------------------------------------------------- | :---------------------------- | :------------------------------ | :--------------------------------------- |
| **TPS**        | 极高（链下千级，每秒打包几十笔上链）                         | 中等（链上 ~20 TPS）          | 极低（EVM ~3-5 TPS）            | 极高（和本项目类似）                     |
| **Gas 成本**   | 低（每笔 ~$0.5，多笔打包）                                   | 低（每笔 ~$0.3）              | 极高（挂单+撮合 ~$5+）          | 极低（批量固定 gas）                     |
| **信任假设**   | 撮合引擎不篡改订单签名（链上有签名验证兜底，签名是用户自己签的，引擎改不了） | 资金池不被掏空（靠价差+保险） | 无（纯链上）                    | ZK 证明正确（概率性信任）                |
| **MEV 风险**   | 极低（订单在链下匹配）                                       | 低（滑点保护）                | 极高                            | 低（批量提交）                           |
| **资金效率**   | 最高（全仓跨市场对冲）                                       | 低（需要资金池缓冲）          | 中                              | 最高                                     |
| **实现复杂度** | 中（链上 Solidity + 链下 Go 撮合引擎 + DB）                  | 低（只需链上合约）            | 中（全 Solidity 但 gas 优化难） | 极高（撮合 + ZK Prover + 链上 Verifier） |
| **抗审查**     | 中（撮合引擎如果被封，用户还能 withdraw）                    | 高（合约就在链上）            | 极高                            | 中                                       |



| 路径      | 签名主体     | 校验方式                                                   | 适用场景                                   | 为什么需要                                                   |
| :-------- | :----------- | :--------------------------------------------------------- | :----------------------------------------- | :----------------------------------------------------------- |
| **路径1** | EOA 本人     | `ECDSA.tryRecover` 得到的地址 == `order.signer`            | 普通散户用自己钱包签名下单                 | 最基础的身份验证——链上订单是撮合引擎代提的，必须证明用户同意 |
| **路径2** | 授权操作员   | `ECDSA.tryRecover` 得到的地址 ∈ `operatorRegistry[signer]` | 量化机器人、做市商、托管方代下单           | 高频场景下用户不想每个订单都手动签名；操作员只有签名权限，无资金权限 |
| **路径3** | 智能合约账户 | 调用合约自己的 `IERC1271.isValidSignature`                 | ERC-4337 智能账户、Safe 多签、风险管理合约 | 智能合约没有私钥，ECDSA 用不了，必须让合约自己验证签名有效性 |

# 从业务视角看这个永续合约交易所的代码实现

## 一、先搞清楚：这个产品到底在做什么？

**一句话**：它是一个**链上资金托管 + 链下撮合 + 链上最终结算**的永续合约交易所。

解决的核心矛盾：

| 纯链上交易所（Uniswap、dYdX早期）      | 纯中心化交易所（Binance） | 这个项目的方案                                         |
| :------------------------------------- | :------------------------ | :----------------------------------------------------- |
| 撮合慢（每笔上链）、gas贵              | 用户资金存平台跑路风险    | 资金链上托管（安全），撮合链下（快），结算链上（权威） |
| 不能做复杂订单（市价、止损、撮合队列） | 可做任何订单类型          | 链下撮合引擎实现 FIFO + 价格优先，和 CEX 体验一致      |
| 无 MEV 但 gas 成本全用户承担           | 有内部员工作恶风险        | 订单 EIP-712 签名，撮合引擎无法篡改订单内容，只能撮合  |

**业务定位**：想做一个"体验像 CEX（撮合快、支持限价单），但资金安全像 DEX（用户持私钥、链上托管）"的永续合约。

------

## 二、核心业务流程 + 代码实现

### 流程总览

text



```
用户开户充USDC → 链下签名订单 → 后端撮合引擎匹配 → 链上Dealer验证+Perpetual结算 → 定时资金费率调整 → 被清算/主动平仓 → 申请取款
     ↑ 存款监听       ↑ EIP-712       ↑ 内存撮合+FIFO      ↑ 链上权威验签        ↑ 外部预言机          ↑ 清算折扣模型    ↑ 时间锁防作恶
```

------

### 环节1：资金入场 —— USDC 存款

**业务需求**：用户要交易，首先得把 USDC 充进系统。充的 USDC 必须在链上，不能放后端（防跑路）。

**代码实现**：

text



```
┌─ 链上部分 ─────────────────────────────────────────────────┐
│  用户调 USDC 合约: transferFrom(用户, Treasury地址, amount) │
│  → USDC 合约 emit Transfer(from=用户, to=Treasury, value)  │
│  → Treasury 是 Dealer 合约的收款地址                         │
└────────────────────────────────────────────────────────────┘
         │
         │ FilterLogs（每12秒轮询）
         ▼
┌─ 后端部分 (TreasuryDepositWatcher) ──────────────────────┐
│  1. 查 USDC 合约的 Transfer 事件                           │
│  2. 过滤 to == TreasuryAddress 的记录                      │
│  3. 写 deposits 表：{user, amount, txHash, blockNumber}   │
│  4. 调用 Dealer.deposit(user, amount)？不——直接在链上累加  │
│     实际上用户已经 transferFrom 到 Treasury 了              │
│     Dealer 通过 eth_call 查 USDC.balanceOf(Treasury)       │
│     或者 deposit 函数做内部转账记账                          │
└────────────────────────────────────────────────────────────┘
```

**为什么不用"用户调 Dealer.deposit(amount)"？** 因为那样 Dealer 合约要实现 ERC20 的 approve + transferFrom 逻辑，每笔存款都要合约消耗 gas。而让用户直接 transferFrom 到 Treasury，Dealer 只需要记录"用户转了多少"——**后端 FilterLogs 拿到事件后，用链上记账的方式更新 primaryCredit[user]**。

------

### 环节2：用户下单 —— 链下签名

**业务需求**：

- 用户想开多/开空 BTC-PERP，出价 $30000，数量 0.1 BTC
- 这个订单不能直接上链（上链慢且贵），而是让后端撮合
- 但后端不能伪造订单、不能篡改用户意愿

**代码实现**（`Types.Order` 结构）：

solidity



```solidity
struct Order {
    address perp;           // BTC-PERP 合约地址（确定市场）
    address signer;         // 签名者（谁挂的单）
    int128 paperAmount;     // +1e18 = 买1BTC多，-1e18 = 卖1BTC空
    int128 creditAmount;    // -30000e6 = 愿意付30000U，+30000e6 = 要收30000U
    bytes32 info;           // 打包了 makerFeeRate + takerFeeRate + expiration + nonce
}
```

**业务设计意图**：

- `paperAmount` 和 `creditAmount` 必须**异号**：买 BTC → paper+ credit-（你要付 USDC）；卖 BTC → paper- credit+（你要收 USDC）
- 价格不用单独存一个 price 字段，而是 `|creditAmount| / |paperAmount|` 推导——节省 storage slot
- `info` 把 4 个小字段打包成 1 个 bytes32——**一个 storage slot 装 4 个东西，节省 gas**

**签名防伪造**：

text



```
用户私钥 → 签 EIP-712 digest（包含以上所有字段）→ 得到 65 字节 signature
用户把 Order + signature 一起发给后端
```

后端**无法修改任何字段**——改了 digest 就变了，链上验签就不通过。

------

### 环节3：撮合引擎 —— 内存撮合 + 链上最终确认

**业务需求**：

- 要快（像 CEX 一样毫秒级撮合）
- 撮合逻辑必须公平（FIFO + 价格优先）
- 撮合结果必须提交链上**权威确认**（后端自己说了不算）

**代码实现**（`matchengine.go`）：

text



```
用户下单 → REST API → DB（幂等检查 orderId 是否已存在）→ MatchEngine.AddOrder()
                                                              │
                                                              ▼
                                                    内存事件队列（channel）
                                                              │
                                                              ▼
                                                    eventLoop() 单线程消费
                                                              │
                                          ┌───────────────────┼───────────────────┐
                                          │                   │                   │
                                    新订单事件            定时 ticker(100ms)    提交 ticker(1s)
                                          │                   │                   │
                                    matchIncomingOrder()  match()          submitTrades()
                                          │                   │                   │
                                    Taker 吃簿中 Maker    盘口交叉自动撮合     对每笔撮合...
                                          │                   │                   │
                                    FIFO 队列找最优价档    bestCrossPairLocked  BuildMatchTradeData()
                                    nextMatchableMaker()   检查买一≥卖一        EncodeTradeData()
                                          │                                       │
                                    撮合成功 → enqueueMatch()             SubmitPerpTrade()
                                    撮合失败 → 内存簿等待                  eth.SendTransaction()
                                                                                  │
                                                                          bind.WaitMined() ← 等链上回执
                                                                                  │
                                                                     ┌─────────────┴─────────────┐
                                                                     ✅ Status=1            ❌ Status=0/超时
                                                                     订单 filledAmount++    rollbackMatch()
                                                                     trades 表 INSERT       内存簿恢复剩余量
```

**关键设计决策**：

| 决策                         | 原因                                                         |
| :--------------------------- | :----------------------------------------------------------- |
| **单线程 eventLoop**         | 撮合逻辑涉及内存簿的并发读写，单线程 queue 避免锁竞争，比多线程加锁更简单高效 |
| **100ms 撮合 + 1s 批量上链** | 撮合频繁（毫秒级变动），上链成本高（每笔 gas）。批量减少 gas 次数 |
| **提交失败 → 内存回滚**      | 链上可能因为验签没过、保证金不足、订单过期而 revert。内存簿必须能恢复撮合状态继续撮合 |
| **FIFO 队列**                | 同价位先到先成交——公平，避免后来者插队                       |

------

### 环节4：链上结算 —— Dealer 验签 + Perpetual 记账

**业务需求**：

- 后端提交的 tradeData 链上必须**独立验证**——后端可能作恶，不能直接信
- 结算必须原子化：要么所有交易者都结算成功，要么全部 revert

**代码实现**（`Perpetual.trade` + `Dealer.approveTrade`）：

text



```
后端提交: Perpetual.trade(tradeData)
  │
  ├─ tradeData = abi.encode(orderList, signatureList, matchPaperAmount)
  │
  ├─ Perpetual.trade() 调用:
  │   IDealer(owner()).approveTrade(msg.sender, tradeData)
  │     │
  │     ├─ 1. 验证 msg.sender ∈ validOrderSender（只有注册的撮合引擎能调）
  │     │
  │     ├─ 2. 解码 tradeData → orderList, signatureList, matchPaperAmount
  │     │
  │     ├─ 3. 对每个订单做 EIP-712 验签：
  │     │     ECDSA.tryRecover(digest, signature) → signerCandidate
  │     │     ├─ signerCandidate == order.signer → ✅ EOA 本人签的
  │     │     ├─ operatorRegistry[signerCandidate][order.signer] == true → ✅ 授权 Operator 签的
  │     │     └─ IERC1271(order.signer).isValidSignature() == MAGIC_VALUE → ✅ 智能合约钱包自签
  │     │
  │     ├─ 4. 检查订单未过期（expiration > block.timestamp）
  │     │
  │     ├─ 5. 累计已成交量:
  │     │     orderFilledPaperAmount[orderHash] += matchPaperAmount
  │     │     require(累计量 <= order.paperAmount, "超过订单总量")
  │     │
  │     └─ 6. 返回: traderList[], paperChangeList[], creditChangeList[]
  │           （每个交易者在这次交易中 paper 和 credit 的变化量）
  │
  ├─ Perpetual.trade() 拿到结果后:
  │   for each trader in traderList:
  │     _settle(trader, paperChange, creditChange)
  │
  └─ 最后: require(Dealer.isAllSafe(traderList), "交易后有人不安全 → 全 revert")
```

**业务设计亮点**：

1. **验证与执行分离**：`Dealer.approveTrade` 只负责验证订单、计算结果，`Perpetual._settle` 只负责记账。这样 Dealer 可以被多个 Perpetual 市场复用，不需要每个市场重写验证逻辑。
2. **三种签名验证路径**：支持 EOA 直接签、Operator 代签（给量化机器人用）、IERC-1271 合约钱包签（给 Gnosis Safe 等智能合约钱包用）——覆盖了所有主流用户类型。
3. **交易后安全性检查**：`isAllSafe(traderList)` —— 撮合成功不等于合法，交易后如果某个交易者的保证金率已经低于维持保证金率，**整笔交易全部 revert**。这保护了系统不接受会导致立即清算的交易。
4. **订单去重**：同一交易者在同一市场挂了多个 Maker 单，链上会合并计算——避免重复结算同一个人的持仓变化。

------

### 环节5：资金费率 —— 定时上传，自动结算

**业务需求**：

- 永续合约要跟踪现货价格（不交割），靠资金费率让多头和空头互相补偿
- 多头占优时，多头付钱给空头；空头占优时反过来
- 资金费率变化后，持仓的 USDC 余额要实时反映变化

**代码实现**（存储优化）：

solidity



```solidity
// Perpetual 不直接存 credit，而是存 reducedCredit：
// credit = paper * fundingRate + reducedCredit
//                ↑ 累计资金费率

// fundingRate 变化时：
Perpetual.updateFundingRate(newRate)
  fundingRate = newRate  // 只改一个全局变量！
  
// 用户查询余额时（balanceOf）：
credit = paper.decimalMul(fundingRate) + reducedCredit
//                       ↑ 自动包含了最新资金费率的影响！
```

**这是一个绝妙的存储优化**——传统方法是每笔资金费率更新时，遍历所有持仓者逐一结算（O(N)，gas 爆炸）。而这个项目用**数学关系把遍历变成了全局变量更新**（O(1)）：

text



```
原来的 credit = oldFundingRate × paper + reducedCredit
新的 credit   = newFundingRate × paper + reducedCredit
差值          = (newFundingRate - oldFundingRate) × paper
              = ΔfundingRate × paper
```

**资金费率变化 → credit 自动增减，不需要遍历任何人！**

------

### 环节6：清算 —— 保证金不足时的强制平仓

**业务需求**：

- 用户净值不足以覆盖维持保证金时，强制平仓
- 清算者（愿意接手的人）以折扣价接盘，作为清算激励
- 系统有保险基金兜底极端情况（坏账）

**代码实现**（全仓保证金模型）：

text



```
Liquidator 机器人（后端定时查）:
  chain.IsSafe(trader) == false?
    │
    ├─ ✅ 不安全 → 调 Perpetual.liquidate(liquidator, liquidatedTrader, requestPaper, expectCredit)
    │
    ▼
Perpetual.liquidate():
  │
  ├─ Dealer.requestLiquidation()
  │     │
  │     ├─ netValue = primaryCredit + secondaryCredit + Σ(paper_i × markPrice_i)
  │     ├─ exposure = Σ|paper_i × markPrice_i|
  │     ├─ require(netValue < exposure × liquidationThreshold, "还不需要清算")
  │     │
  │     ├─ 清算价格（固定折扣模型）：
  │     │   清多头 → markPrice × (1 - liquidationPriceOff)
  │     │   清空头 → markPrice × (1 + liquidationPriceOff)
  │     │
  │     ├─ liqtorCreditChange = -清算价 × requestPaper
  │     │   （清算者付 USDC，得到仓位）
  │     │
  │     └─ insuranceFee = |creditChange| × insuranceFeeRate
  │        （保险费从被清算者身上扣，转入 insurance 地址）
  │
  ├─ 价格保护检查（清算者传 expectCredit，防止价格滑点太离谱）
  │
  ├─ _settle(liquidatedTrader, paperChange, creditChange)  // 被清算者仓位减少
  ├─ _settle(liquidator, liqtorPaperChange, liqtorCreditChange)  // 清算者接手仓位
  │
  └─ require(isSafe(liquidator), "清算者接手后自己也不安全 → 回滚")
  
  // 如果被清算者仓位完全归零:
  Dealer.handleBadDebt(liquidatedTrader)
    ├─ 如果 primaryCredit[liquidatedTrader] < 0（还是负数 = 倒欠系统）
    │   保险账户 primaryCredit[insurance] -= 这个负数  // 保险基金补窟窿
    └─ 否则 → 正常 realizePnl，primaryCredit 记为正数（剩余的钱）
```

**业务设计要点**：

1. **全仓保证金，按市场执行**：触发条件是全局净值 < 全局维持保证金，但清算按单个市场执行。用户可以在一个市场被清，其他市场仓位保留——不是一爆全爆。
2. **价格保护双向的**：清算者给 `expectCredit`（期望的 credit 变化），链上算实际价格，**实际价格不能差太多**。如果市场波动导致清算价格偏离，清算者可以 reject 交易（保护自己）。
3. **保险费机制**：被清算者按清算金额的一定比例付保险费，累加到保险账户。极端情况下如果被清算者连保险费都付不起（净值已经非常负），保险账户承担坏账。

------

### 环节7：取款 —— 时间锁防作恶

**业务需求**：

- 用户赚钱了想把 USDC 提走
- 但不能让用户在撮合引擎刚帮他成交了一笔还没来得及上链结算的交易后，立刻把保证金提走（那笔交易就变成了无保证金交易）

**代码实现**（时间锁机制）：

solidity



```solidity
// 取款流程（Operation.sol）：
function requestWithdraw(amount) external {
    pendingPrimaryWithdraw[user] = amount
    withdrawExecutionTimestamp[user] = block.timestamp + withdrawTimeLock
    // withdrawTimeLock 通常是几分钟
}

function executeWithdraw() external {
    require(block.timestamp >= withdrawExecutionTimestamp[user], "时间锁没过")
    require(primaryCredit[user] >= pendingPrimaryWithdraw[user], "余额够")
    primaryCredit[user] -= pendingPrimaryWithdraw[user]
    // 然后把 Treasury 里对应的 USDC 转到用户钱包
}

// 关键：撮合引擎在 submitBatch 之前会检查：
// 如果用户有 pendingWithdraw，这笔交易就不应该撮合他
// 或者撮合引擎在创建订单时检查 withdrawExecutionTimestamp
```

**为什么需要时间锁？**

text



```
场景：
1. 用户挂了一个买单 0.1 BTC @ $30000，保证金 3000 USDC 在 primaryCredit 里
2. 撮合引擎还没来得及把这笔交易提交链上（卡在内存里）
3. 用户立刻调 requestWithdraw(3000) + executeWithdraw
4. 如果没有时间锁，primaryCredit 变成 0
5. 撮合引擎提交 Perpetual.trade() 时，链上结算发现用户 primaryCredit < 需要的保证金
6. revert → 撮合失败 → 但买方已经以为能以 $30000 买到了，卖方也挂了单

时间锁（比如 5 分钟）保证：撮合引擎有足够时间把交易提交链上结算，结算完成后 primaryCredit 变化了，用户再申请取款。
```

------

## 三、完整数据流总结

text



```
                    链上（不可篡改）                链下（高性能）
                    ──────────────                ──────────────
用户私钥签名 ──→    EIP-712 domainSeparator 验证
                    (Dealer 构造)
                        │
                        ▼
                 Dealer.approveTrade()
                 ├─ 验 ECDSA 签名（EOA / Operator / IERC-1271）
                 ├─ 查 orderFilledPaperAmount 累计量（防重复）
                 ├─ 算 creditChange / paperChange（Trading._matchOrders）
                 └─ 返回 MatchResult
                        │
                        ▼
                 Perpetual._settle()
                 ├─ balanceMap[trader].paper += paperChange（int128）
                 ├─ balanceMap[trader].reducedCredit += creditChange 调整
                 ├─ 实际 credit = paper × fundingRate + reducedCredit
                 ├─ 新开仓 → Dealer.openPosition（记录到 openPositions[]）
                 └─ 全平仓 → Dealer.realizePnl（profit → primaryCredit）
                        │
                        ▼
                 Dealer.isAllSafe()（交易后保证金安全检查）
                 ├─ netValue = primaryCredit + Σ(paper × markPrice)
                 ├─ exposure = Σ|paper × markPrice|
                 └─ netValue >= exposure × liquidationThreshold？
                    不满足 → 整笔交易 revert！

后端撮合引擎 ──→   内存 OrderBook（FIFO 队列）
                 ├─ pricePriority: 买单高价先、卖单低价先
                 ├─ timePriority（FIFO）: 同价位先挂先成交
                 └─ matchIncomingOrder + 盘口自动撮合

后端资金费率 ──→   Dealer.updateFundingRate()
                 └─ Perpetual.fundingRate 全局更新（O(1) gas）
                    用户 credit 自动变化（靠 fundingRate 公式）

后端清算机器人 ──→ Perpetual.liquidate()
                 ├─ Dealer.requestLiquidation 判断是否需要清
                 ├─ 固定折扣价：markPrice × (1 ± off)
                 ├─ 保险费扣给 insurance 账户
                 └─ 仓位全清后 handleBadDebt 处理坏账

后端存款监听 ──→   TreasuryDepositWatcher (FilterLogs)
                 ├─ USDC Transfer(to=Treasury) 事件
                 ├─ 写 deposits 表
                 └─ 触发链上 primaryCredit 增加
```

------

## 四、最核心的业务设计思想

整个项目有一个贯穿始终的设计理念：**链下做计算密集的事，链上只做权威确认和最终记账**。

| 环节     | 链下做什么           | 链上做什么                           | 为什么这样分                                |
| :------- | :------------------- | :----------------------------------- | :------------------------------------------ |
| 下单     | 用户签名             | 验签（最终权威）                     | 链上验签 gas 贵，链下快但链上是最终裁判     |
| 撮合     | 内存 FIFO + 价格优先 | 验证 orderSender 白名单 + 累计成交量 | 撮合高频且复杂，链上跑不动                  |
| 结算     | 无                   | 改 balanceMap + isAllSafe 检查       | 资金安全关键，必须链上原子执行              |
| 资金费率 | 本地算数值           | 只更新一个全局 fundingRate 变量      | 遍历所有持仓者 O(N) gas 太贵，O(1) 更新解决 |
| 清算     | 检测不安全用户       | 价格保护 + 折扣清算 + 保险费         | 清算条件判断链下算，执行链上做              |
| 取款     | 无                   | 时间锁 + primaryCredit 扣减          | 资金最终出口，必须链上原子                  |

**这套架构的最大优势**：撮合速度和 CEX 一样快（内存里毫秒级匹配），但资金安全和 DEX 一样高（用户持私钥、链上托管）。撮合引擎即使作恶（故意不撮合某用户），最多导致该用户订单没人接，但**无法偷资金、无法篡改订单内容**——因为订单内容被用户签名锁死，结算被链上锁死。







## 一、架构认知（10题）

### Q1. 这个项目由哪几个核心合约组成？它们之间的继承关系是什么？

**核心合约分两组：**

**第一组：MetaNodeDealer 合约组（一个最终合约，拆分为多个 abstract）**

- MetaNodeStorage — 基础存储合约，继承 OpenZeppelin 的 Ownable + ReentrancyGuard
- MetaNodeExternal — 外部调用函数（存款/取款/交易/清算），继承 MetaNodeStorage + IDealer
- MetaNodeOperation — 管理配置函数（onlyOwner），继承 MetaNodeStorage + IDealer
- MetaNodeView — 视图查询函数，继承 MetaNodeStorage + IDealer
- MetaNodeDealer — 最终部署合约，组合继承 MetaNodeExternal + MetaNodeOperation + MetaNodeView

**第二组：Perpetual 合约（独立部署，每个市场一个实例）**

- Perpetual — 继承 Ownable + IPerpetual，owner 是 Dealer 合约地址

**辅助合约：**

- Subaccount — 子账户合约，支持 Clone 模式部署
- OracleAdaptor / PythOracleAdaptor / ConstOracle / EmergencyOracle — 预言机适配器

------

### Q2. MetaNodeDealer 合约被拆分成了哪几个 abstract contract？为什么要这样拆分？

**拆分为三个 abstract contract：**

- MetaNodeExternal — 外部调用函数
- MetaNodeOperation — 管理配置函数
- MetaNodeView — 视图查询函数

**拆分原因：**

1. **EIP-170 限制**：单个合约字节码不能超过 24KB，Dealer 功能多不拆分会超限
2. **模块化**：按功能分类（外部调用/管理配置/查询视图），代码结构清晰
3. **可读性**：利于开发和排查问题
4. **gas 优化**：view 函数不改变状态，便于编译器优化

------

### Q3. Perpetual 合约和 MetaNodeDealer 合约是什么关系？一个 Dealer 可以对应几个 Perpetual？

**关系：调用关系，不是继承或代理关系。**

- Perpetual 的 owner 是 MetaNodeDealer 合约地址（部署时通过 transferOwnership(_owner) 设置）
- Perpetual 通过 IDealer 接口回调 Dealer 的 approveTrade、openPosition、realizePnl、requestLiquidation
- Dealer 中用 onlyRegisteredPerp modifier 验证调用者是已注册的 Perpetual

**数量：一个 Dealer 可以对应无限多个 Perpetual**，每个交易市场（BTC-PERP、ETH-PERP 等）对应一个独立的 Perpetual 合约实例，通过 setPerpRiskParams 注册到 Dealer。

------

### Q4. 项目中有几种预言机适配器？它们分别适用于什么场景？为什么需要 EmergencyOracle？

**4 种预言机适配器：**

| 适配器            | 适用场景                                                     |
| ----------------- | ------------------------------------------------------------ |
| ConstOracle       | 测试场景，返回固定价格                                       |
| OracleAdaptor     | 生产环境，从 Chainlink 获取价格，支持切换到自定义价格（带偏离保护） |
| PythOracleAdaptor | 生产环境，从 Pyth 网络获取价格（适用于 Pyth 支持的资产）     |
| EmergencyOracle   | 应急场景，当主预言机故障或被操纵时，由 owner 强行设置价格    |

**EmergencyOracle 的必要性：**

- Chainlink/Pyth 可能出现故障或延迟
- 市场极端波动时需要人工干预
- 防止预言机被攻击导致错误清算

------

### Q5. Subaccount.sol 的作用是什么？它和主合约的关系是怎样的？

**Subaccount 是一个通用执行合约**，核心功能：

1. **风险隔离**：通过子账户开仓，与主账户风险隔离
2. **委托交易**：可授权 operator 代为交易，但限制资金操作权限
3. **灵活执行**：通过 execute(to, data, value) 调用任意合约函数

**与主合约关系：**

- Subaccount 是独立部署的合约，不是 Dealer 的一部分
- 用户通过 Subaccount 的 execute() 调用 Dealer 的 deposit()、setOperator() 等函数
- 使用 Clone 模式（EIP-1167）低成本部署
- 所有权不可转让（安全设计），只能初始化一次

------

### Q6. 前端有两种充值方式，它们在资金走向、合约调用、信任模型上有什么本质区别？

| 维度             | Dealer Deposit（链上保证金）    | Treasury Transfer（托管充值）   |
| ---------------- | ------------------------------- | ------------------------------- |
| **合约调用**     | dealer.deposit(amount, 0, addr) | usdc.transfer(treasury, amount) |
| **交易数**       | 2笔（approve + deposit）        | 1笔（transfer）                 |
| **资金位置**     | Dealer 智能合约地址             | Treasury EOA 地址               |
| **记账方式**     | 链上 primaryCredit[user]        | 链下数据库 ledger_balances 表   |
| **能否直接交易** | 能                              | 不能                            |
| **取款方式**     | requestWithdraw/fastWithdraw    | 由后端处理                      |
| **信任模型**     | 信任智能合约逻辑                | 信任运营方不跑路                |

------

### Q7. 用户在 UsdcDepositForm 中把 USDC 转到 Treasury 地址后，后端做了什么操作？这笔钱能否直接用于永续合约交易？如果不能，还需要什么操作？

**后端操作（TreasuryDepositWatcher）：**

1. 轮询链上 USDC 合约的 Transfer 事件
2. 发现 to == Treasury 地址 的转账后，提取 sender 和 amount
3. 写入 deposits 表（充值流水记录）
4. 更新 ledger_balances 表（链下账本余额增加）

**不能直接用于交易。** Treasury 中的 USDC 只在数据库中有记录，链上 Dealer 合约不认识这笔钱。

**还需要操作：** 调用 dealer.deposit(amount, 0, userAddress) 将 USDC 从 Treasury 地址转入 Dealer 合约，才会更新链上 primaryCredit。

------

### Q8. 后端的 getbalancelogic.go 中 primaryMerged = pc + ledgerAmt 合并了什么？这种合并展示有什么潜在问题？

**合并内容：** 链上 Dealer 合约中的 primaryCredit（pc）+ 链下 Treasury 账本的 ledgerAmt。

**潜在问题：**

1. **清算只认链上**：爆仓清算时只看链上 primaryCredit，Treasury 中的资金不能用于维持保证金
2. **误导用户**：用户看到合并余额以为可用于交易，但实际只有链上部分能交易
3. **数据同步延迟**：链上读取和数据库读取有速度差异，可能导致余额展示不一致
4. **审计困难**：需要区分哪部分是链上资金、哪部分是链下资金
5. **子账户问题**：链上 primaryCredit 支持 Subaccount 作为 trader，但链下 ledger 是否支持取决于后端实现

------

### Q9. 项目不需要管理员界面的原因是什么？所有管理操作通过什么方式完成？

**原因：**

1. 所有管理函数都是 onlyOwner 的合约函数，通过 cast send 或 Foundry 脚本直接调用
2. 管理操作低频且简单（设参数、注册市场、更新费率），不需要 GUI
3. 去中心化设计理念——没有中心化后台管理系统
4. 这是教学项目，管理界面非重点

**完成方式：**

- 部署和配置通过 Foundry 脚本（如 DeploySepolia.s.sol）
- 日常费率更新通过 fundingRateKeeper 调用 updateFundingRate
- 参数调整通过 Owner 调用 setPerpRiskParams 等函数

------

### Q10. 部署脚本 DeploySepolia.s.sol 中按顺序配置了哪几个角色地址？如果漏配其中一个会怎样？

**配置的 4 个角色地址：**

1. **deployer** → Owner（部署者，即合约所有者）
2. **orderSender** → setOrderSender(orderSender, true)（撮合引擎）
3. **insurance** → setInsurance(insurance)（保险账户）
4. **fundingKeeper** → setFundingRateKeeper(fundingKeeper)（费率更新者）

**漏配影响：**

- 漏配 Owner：合约无法部署（无人付 gas）
- 漏配 orderSender：不能撮合订单、不能提交交易到链上
- 漏配 insurance：清算时保险费无处可转，坏账无法处理
- 漏配 fundingKeeper：不能更新资金费率，市场费率机制失效

------

## 二、资金流与角色（10题）

### Q11. 项目中一共有几种角色（包括委托角色）？分别列出它们和对应的权限范围。

**8 种角色：**

| 角色                           | 权限来源              | 权限范围                                     |
| ------------------------------ | --------------------- | -------------------------------------------- |
| **Owner（所有者）**            | onlyOwner             | 设置风险参数、注册市场、管理权限             |
| **FundingRateKeeper**          | onlyFundingRateKeeper | 定期更新资金费率                             |
| **OrderSender（撮合引擎）**    | validOrderSender      | 收集链下签名订单，匹配后提交链上，收取手续费 |
| **Trader（交易者）**           | 普通用户              | 存款、取款、签名订单、被清算                 |
| **Liquidator（清算者）**       | 任何人                | 触发清算，以折扣价接手被清算者仓位           |
| **Insurance（保险账户）**      | 系统账户              | 收取清算保险费，承担坏账损失                 |
| **Operator（订单操作员）**     | setOperator           | 可代替用户签名订单，**不能操作资金**         |
| **FundOperator（资金操作员）** | approveFundOperator   | 在授权额度内操作用户资金（取款等）           |

------

### Q12. onlyOwner、onlyFundingRateKeeper、onlyRegisteredPerp 这三个 modifier 分别保护了哪些函数？它们的权限主体分别是谁？

| Modifier              | 权限主体                    | 保护的函数                                                   |
| --------------------- | --------------------------- | ------------------------------------------------------------ |
| onlyOwner             | 合约部署者（Owner 地址）    | setPerpRiskParams、setFundingRateKeeper、setInsurance、setMaxPositionAmount、setWithdrawTimeLock、setOrderSender、setFastWithdrawalWhitelist、setWithdrawlWhitelist、disableFastWithdraw、setSecondaryAsset |
| onlyFundingRateKeeper | 费率更新者地址              | updateFundingRate                                            |
| onlyRegisteredPerp    | 已注册的 Perpetual 合约地址 | approveTrade、requestLiquidation、openPosition、realizePnl   |

------

### Q13. onlyRegisteredPerp 中检查的是 msg.sender，这意味着哪些函数只能由谁调用？为什么 approveTrade 不能被用户直接调用？

**只能由已注册的 Perpetual 合约地址调用**（state.perpRiskParams[msg.sender].isRegistered）。

**approveTrade 不能被用户直接调用的原因：**

- approveTrade 是 Perpetual.trade() 内部回调 Dealer 的函数
- 用户调用 Perpetual.trade(tradeData) → Perpetual 再调用 Dealer.approveTrade(orderSender, tradeData)
- 这样设计确保交易结算经过 Perpetual 合约的逻辑，用户无法绕过 Perpetual 直接操作 Dealer 的余额

------

### Q14. OrderSender（撮合引擎）的角色权限是如何校验的？它用的是 modifier 还是内联 require？校验的参数是 msg.sender 还是其他变量？

**使用内联 require，不是 modifier。**

**校验的是 orderSender 参数**（从 tradeData 中解析出来的），**不是 msg.sender**。

原因：因为有 onlyRegisteredPerp modifier，msg.sender 是 Perpetual 合约地址，真正的撮合引擎地址作为参数传入。

------

### Q15. 用户可以授权两种操作员：Operator 和 FundOperator，它们的区别是什么？分别通过什么函数设置？各自能操作什么？

| 维度         | Operator                                | FundOperator                         |
| ------------ | --------------------------------------- | ------------------------------------ |
| **设置函数** | setOperator(operator, isValid)          | approveFundOperator(spender, amount) |
| **权限范围** | 可代替用户签名订单                      | 可代替用户执行取款                   |
| **资金操作** | **不能操作资金**                        | 有授权额度限制                       |
| **校验方式** | operatorRegistry[signer][recoverSigner] | primaryCreditAllowed[from][spender]  |
| **额度限制** | 无额度概念                              | 有授权额度，取款不能超过额度         |

------

### Q16. 一次完整的充值→开仓→平仓→取款的资金流是怎样的？画出资金在各环节的物理位置和记账位置。

------

### Q17. requestWithdraw 和 fastWithdraw 有什么区别？时间锁的设计目的是什么？fastWithdraw 什么条件下可用？

| 维度       | requestWithdraw                | fastWithdraw             |
| ---------- | ------------------------------ | ------------------------ |
| **步骤**   | 两步：申请 → 等待时间锁 → 执行 | 一步完成                 |
| **时间锁** | 有，需等待 withdrawTimeLock 秒 | 无                       |
| **条件**   | 任何用户                       | 需在白名单中且功能未禁用 |

**时间锁目的：** 防止用户在订单已撮合但尚未链上结算的窗口期取走保证金。链下撮合和链上结算之间有时间差，如果允许立即取款，链下已匹配的订单在链上结算时可能因余额不足而失败。

**fastWithdraw 可用条件：**

- !state.fastWithdrawDisabled（功能未被禁用）
- state.fastWithdrawalWhitelist[msg.sender]（调用者在白名单中）

------

### Q18. executeWithdraw 中 isInternal=true 和 isInternal=false 的区别是什么？param 参数非空时会发生什么？

| isInternal | 行为                                                         |
| ---------- | ------------------------------------------------------------ |
| true       | 内部转账：资金不离开合约，只修改余额映射（from 扣减，to 增加） |
| false      | 外部提现：实际 ERC20 转账，USDC 从合约转出到 to 地址         |

**param 参数非空时：**

- 执行 ERC20 转账后，调用 to 地址的回调函数：to.call(param)
- to 地址必须在取款白名单中（isWithdrawalWhitelist[to]）
- 用于实现"取款后自动执行某操作"的场景（如存入其他协议）

------

### Q19. 保险账户（Insurance）在什么场景下被使用？坏账是如何产生和处理的？

**Insurance 使用场景：**

1. **收取保险费**：每次清算时从被清算者收取 insuranceFee = liqtorCreditChange.abs() * insuranceFeeRate
2. **承担坏账**：清算后被清算者资不抵债时，由 Insurance 承担亏损

**坏账产生条件：** 清算后被清算者的 primaryCredit < 0（资不抵债）。

**处理流程（handleBadDebt）：**

1. 将被清算者的负余额转移给 Insurance 账户
2. Insurance 账户余额减少（承担亏损）
3. 被清算者余额清零

------

### Q20. 资金费率是正数时，多头和空头谁付谁？资金费率是累计值还是瞬时值？在代码中体现在哪里？

**资金费率是累计值。** 当 fundingRate **上升**时（正的变化量），**多头获益，空头支付**。

公式：credit = paper * fundingRate + reducedCredit

- 多头（paper > 0）：fundingRate 上升 → credit 增加 → 获益
- 空头（paper < 0）：fundingRate 上升 → credit 减少 → 支付

**代码体现：**

- [Perpetual.sol:74](file:///Users/Ssl80443/contract/perpetual-contract/src/Perpetual.sol#L74)：credit = paper.decimalMul(fundingRate) + int256(balanceMap[trader].reducedCredit)
- fundingRate 由 fundingRateKeeper 通过 updateFundingRate 更新
- 存储的是 reducedCredit 而非 credit，这样费率更新后无需额外存储写入

------

## 三、交易与清算机制（12题）

### Q21. 订单结构 Order 中 paperAmount 和 creditAmount 的符号关系是什么？买单和卖单分别是什么样的符号组合？为什么必须异号？

**符号关系：必须异号。**

| 订单类型     | paperAmount | creditAmount     |
| ------------ | ----------- | ---------------- |
| 买单（开多） | 正数        | 负数（付出资金） |
| 卖单（开空） | 负数        | 正数（获得资金） |

**必须异号的原因：** 如果同号，意味着你既获得仓位又获得资金，等于无成本套利。异号确保你获得仓位时必须付出资金（或反之）。

------

### Q22. 用户下单的完整流程是怎样的？从前端签名到链上结算，经过了哪些步骤？

1. **充值**：用户先调用 dealer.deposit() 充值到 Dealer 合约
2. **签名订单**：用户在前端构造 Order 结构，用 EIP-712 标准签名
3. **提交后端**：签名后的订单提交到后端撮合引擎
4. **链下撮合**：后端 matchengine.go 在内存订单簿中撮合买单和卖单
5. **链上提交**：撮合引擎（orderSender）调用 Perpetual.trade(tradeData)
6. **Dealer 验证**：Perpetual 回调 Dealer.approveTrade(orderSender, tradeData)，验证签名、价格、防止自成交
7. **链上结算**：验证通过后 Perpetual._settle() 更新 balanceMap
8. **风险检查**：检查 isSafe，不安全则可被清算

------

### Q23. approveTrade 函数中验证了哪些条件？列出所有 require 检查项及其作用。

1. onlyRegisteredPerp — 调用者是已注册的 Perpetual 合约
2. validOrderSender[orderSender] — 撮合引擎已授权
3. 签名验证 — ECDSA tryRecover 或 EIP-1271 合约钱包验证
4. Trading._info2Expiration(order.info) >= block.timestamp — 订单未过期
5. _priceMatchCheck — Taker 和 Maker 方向相反且价格匹配
6. order.signer != orderList[0].signer（i>0 时） — 防止自成交
7. orderFilledPaperAmount[orderHash] + matchPaperAmount[i] <= |order.paperAmount| — 防止超量成交

------

### Q24. 订单签名验证支持两种方式，分别是什么？在什么情况下用哪种？

1. **ECDSA（tryRecover）**：适用于 EOA 钱包。用 ECDSA.tryRecover(orderHash, signature) 恢复地址，与 order.signer 比较。如果恢复地址 == signer 或恢复地址是 signer 授权的 operator，则通过。
2. **EIP-1271（isValidSignature）**：适用于合约钱包（如 Subaccount、Safe）。当 ECDSA 恢复失败且 order.signer 是合约地址时，调用 IERC1271(signer).isValidSignature(orderHash, signature)，返回 0x1626ba7e 表示有效。

**判断条件：** Address.isContract(order.signer) — 如果 signer 是合约地址，走 EIP-1271。

------

### Q25. 代码中如何防止订单自成交（self-match）？具体逻辑是什么？

**检查 Maker 的 signer 不等于 Taker（orderList[0]）的 signer：**

- i == 0 时是 Taker 自身，跳过检查
- i > 0 时是 Maker，检查 Maker signer != Taker signer
- 同一个 Maker 可以有多个订单（地址相同是允许的）

**目的：** 防止用户自己和自己成交，操纵市场或刷量。

------

### Q26. getOrderFilledAmount 的作用是什么？如果没有这个机制会导致什么问题？

**作用：** 记录每个订单（通过 orderHash 标识）已成交的 paper 数量。

在 approveTrade 中：

并检查：filledAmount + matchAmount <= |order.paperAmount|

**如果没有这个机制：** 同一笔签名订单可以被重复提交撮合，导致超量成交。用户签了一个 1 BTC 的订单，可能被撮合 10 次成交 10 BTC。

------

### Q27. 开仓和平仓在代码层面是如何区分的？openPosition 和 realizePnl 分别在什么条件下被调用？

**判断依据：交易前后 paper 值的变化。**

| 场景      | 交易前 paper | 交易后 paper | 调用的函数                        |
| --------- | ------------ | ------------ | --------------------------------- |
| 开仓      | 0            | 非零         | openPosition(trader)              |
| 平仓      | 非零         | 0            | realizePnl(trader, reducedCredit) |
| 加仓/减仓 | 非零         | 非零（同号） | 不调用上述函数                    |

- openPosition：将市场地址加入 openPositions[trader] 列表
- realizePnl：将 reducedCredit 作为盈亏转入 primaryCredit[trader]，然后清零 reducedCredit，从持仓列表移除该市场

------

### Q28. paper 和 credit 的含义是什么？它们如何反映盈亏？举例说明。

- paper = 仓位数量（正=多头，负=空头）
- credit = 资金量，公式：credit = paper * fundingRate + reducedCredit
- reducedCredit = 存储的约减后的资金量（避免费率更新时重写存储）

**未实现盈亏 = paper \* markPrice + credit**

**举例：**

- 以 $60000 做多 1 BTC：paper=1e18, credit=-60000e6
- 价格涨到 [*o**bj**ec**tO**bj**ec**t*]65000：未实现盈亏=1∗65000+(−60000)=+5000（盈利5000）
- 价格跌到 [*o**bj**ec**tO**bj**ec**t*]55000：未实现盈亏=1∗55000+(−60000)=−5000（亏损5000）

------

### Q29. 清算的触发条件是什么？isSafe 和 isIMSafe 用的保证金率有什么不同？

**清算触发条件：** netValue < exposure * liquidationThreshold（净值 < 敞口 × 维持保证金率）

| 函数     | 检查的保证金率                       | 用途               |
| -------- | ------------------------------------ | ------------------ |
| isSafe   | liquidationThreshold（维持保证金率） | 判断是否可被清算   |
| isIMSafe | initialMarginRatio（初始保证金率）   | 开仓和取款时的检查 |

**关系：** initialMarginRatio > liquidationThreshold（开仓要求更严格，清算阈值更低）

------

### Q30. requestLiquidation 函数的四个返回值分别代表什么？清算者需要付出什么、得到什么？

**四个返回值：**

1. liqtorPaperChange — 清算者获得的仓位变化（与被清算者仓位同方向）
2. liqtorCreditChange — 清算者付出的资金（按折扣价计算，负数表示付出）
3. liqedPaperChange — 被清算者的仓位变化（减少）
4. liqedCreditChange — 被清算者的资金变化

**清算者：**

- 付出：|liqtorCreditChange| 的 credit（资金）
- 获得：liqtorPaperChange 的 paper（仓位），以折扣价 markPrice * (1 - liquidationPriceOff) 成交

------

### Q31. getLiquidationCost 是 view 函数，它的作用是什么？清算者为什么要先调用它？

**作用：** 预览清算成本和收益，返回清算者将获得多少仓位（liqtorPaperChange）、需要付出多少资金（liqtorCreditChange）。

**清算者先调用的原因：**

1. 预估自己接手仓位后是否自身安全（不会因为接手仓位而触发自身清算）
2. 计算预期收益（折扣价与市价的差价）
3. 确定最优的清算数量（requestPaperAmount）

------

### Q32. handleBadDebt 函数在什么条件下被调用？它把坏账转移给了谁？

**调用条件：** 清算后被清算者的 primaryCredit < 0（资不抵债，即坏账）。

**处理方式：**

1. 将被清算者的负余额（primaryCredit 的负值）转移给 Insurance 账户
2. Insurance 账户余额减少（承担亏损）
3. 被清算者余额清零（primaryCredit = 0）
4. 触发 HandleBadDebt 事件

------

## 四、风险参数与数学（8题）

### Q33. RiskParams 结构体包含哪些字段？initialMarginRatio 和 maintenanceMarginRatio 的关系是什么？哪个更大？为什么？

**RiskParams 字段：**

1. initialMarginRatio — 初始保证金率
2. liquidationThreshold — 维持保证金率（清算阈值，等价于 maintenanceMarginRatio）
3. liquidationPriceOff — 清算价格折扣
4. insuranceFeeRate — 保险费率
5. markPriceSource — 标记价格来源合约地址
6. isRegistered — 是否已注册

**关系：** initialMarginRatio > liquidationThreshold

**原因：** 开仓时要求更严格的保证金（如 10%），当保证金降到较低水平（如 5%）时才触发清算。这中间有一个缓冲区，避免价格微小波动就触发清算。

------

### Q34. liquidationPriceOff 参数的作用是什么？它如何影响清算者的收益？

**作用：** 清算时的价格折扣。

- 清算多头：成交价 = markPrice * (1 - liquidationPriceOff)（低于市价）
- 清算空头：成交价 = markPrice * (1 + liquidationPriceOff)（高于市价）

**对清算者收益的影响：** liquidationPriceOff 越大，折扣越大，清算者获得的套利空间越大，清算激励越强。但有约束：liquidationPriceOff + insuranceFeeRate <= liquidationThreshold，确保折扣和保险费之和不超过清算阈值。

------

### Q35. insuranceFeeRate 是从谁身上收取的？流向哪里？

- **收取对象：** 被清算者（从清算金额中扣除）
- **计算公式：** insuranceFee = liqtorCreditChange.abs() * insuranceFeeRate
- **流向：** Insurance 保险账户

------

### Q36. getTraderRisk 返回的 netValue、exposure、initialMargin、maintenanceMargin 分别怎么计算？保证金率的公式是什么？

- netValue = primaryCredit + secondaryCredit + Σ(paper_i * markPrice_i + credit_i)
- exposure = Σ(|paper_i * markPrice_i|)（所有仓位的总敞口）
- initialMargin = exposure * initialMarginRatio
- maintenanceMargin = exposure * liquidationThreshold

**保证金率 = netValue / exposure**

**安全条件：** netValue >= exposure * liquidationThreshold（保证金率 >= 维持保证金率）

------

### Q37. getLiquidationPrice 返回 0 代表什么含义？在什么情况下会返回 0？

**返回 0 代表不会被清算**（即使价格归零也不会爆仓）。

**返回 0 的情况：**

1. paperAmount == 0 — 该市场无仓位
2. 计算出的 liqPrice < 0 — 保证金充足到即使价格归零，净值仍为正，负数时返回 0

------

### Q38. setMaxPositionAmount 限制的是什么？为什么需要限制？限制过大会有什么风险？

**限制内容：** 单个交易者的**最大持仓名义价值**（所有仓位敞口之和的上限）。

**需要限制的原因：**

1. 防止单个用户持仓过大，在市场中占比过高
2. 降低清算时对市场的冲击
3. 防止价格操纵

**限制过大的风险：**

- 单个大户可以操纵市场价格
- 清算时大量仓位需要接手，可能无人愿意清算
- 系统性风险增加

------

### Q39. isSafe（维持保证金检查）和 isAllSafe（批量检查）在 gas 效率上有什么区别？isAllSafe 做了什么优化？

- isSafe(trader) — 检查单个交易者是否满足维持保证金率
- isAllSafe(traderList) — 批量检查多个交易者

**优化：** isAllSafe 在一次调用中检查多个地址，减少多次外部调用的开销。但每个地址仍需遍历其持仓列表计算净值和敞口。

**gas 效率：** 如果需要检查 N 个地址，isAllSafe 比调用 N 次 isSafe 更高效，因为：

1. 减少了 N-1 次外部调用的额外 gas
2. 共享部分计算逻辑

------

### Q40. 交易完成后，如果某个交易者不满足维持保证金要求，会发生什么？这个检查在代码中哪里执行？

**交易不会回滚。** 交易完成后只是更新余额，然后检查 isSafe。如果不安全，该交易者进入**可被清算状态**，但交易本身已经成功。

**检查位置：** 在 Perpetual._settle() 完成余额更新后，Dealer 的 approveTrade 返回后，Perpetual 不主动检查安全性。清算需要由清算者单独发起 liquidate() 调用。

**重要区别：** 开仓时检查 isIMSafe（初始保证金率），但成交后只检查 isSafe（维持保证金率）。如果成交导致从安全变为不安全，不回滚，而是进入可清算状态。

------

## 五、后端与前端集成（8题）

### Q41. 后端一共有几组 REST API？按功能分类列出所有接口。

**8 组共 22 个接口**（前缀 /api/v1）：

| 组            | 接口                                                         |
| ------------- | ------------------------------------------------------------ |
| **认证**      | POST /auth/nonce（获取 nonce）、POST /auth/verify（验证签名，返回 JWT） |
| **账户**      | GET /balance（余额）、GET /deposits（充值记录）、GET /withdraws（取款记录） |
| **资金费率**  | GET /funding-rates（历史）、GET /funding-rate/latest（当前费率） |
| **清算**      | GET /liquidations（清算记录）                                |
| **行情**      | GET /markets、GET /markets/:address、GET /ticker、GET /orderbook、GET /klines、GET /open-quote、GET /order-preview |
| **订单**      | POST /orders、GET /orders、GET /orders/:orderId、POST /orders/cancel |
| **仓位/风险** | GET /positions、GET /risk                                    |
| **成交**      | GET /trades                                                  |

------

### Q42. 用户钱包登录的完整流程是什么？/auth/nonce 和 /auth/verify 分别做了什么？

**完整流程（不需要上链）：**

1. 前端调用 POST /auth/nonce，后端生成一个随机 nonce 返回
2. 前端用钱包私钥对 nonce 签名（EIP-191 personal_sign）
3. 前端将签名发到 POST /auth/verify
4. 后端用 ecrecover 恢复地址，验证后签发 JWT token
5. 后续请求携带 JWT，无需再上链

**/auth/nonce：** 生成随机 nonce，存入数据库（有有效期），返回给前端

**/auth/verify：** 验证钱包签名，验证通过后签发 JWT token，后续请求用 JWT 鉴权

------

### Q43. 后端的撮合引擎 matchengine.go 运行在哪里？它是链上还是链下？撮合完成后如何把结果提交到链上？

**运行位置：后端服务进程内（链下）**

**提交到链上的流程：**

1. 撮合引擎在内存订单簿中匹配买单和卖单
2. 撮合完成后，将匹配结果（订单列表、签名列表、成交数量）编码为 tradeData（bytes）
3. orderSender（授权的 EOA）调用 Perpetual.trade(tradeData)
4. Perpetual 内部调用 Dealer.approveTrade(orderSender, tradeData) 验证
5. 验证通过后 Perpetual._settle() 更新链上余额

------

### Q44. TreasuryDepositWatcher 监听的是什么事件？它如何把链上转账转化为链下账本记录？

**监听事件：** USDC 合约的 Transfer 事件，筛选 to == Treasury 地址 的转账。

**转化流程：**

1. 后端轮询链上 USDC 合约的 Transfer 事件
2. 发现 to == Treasury 地址的转账后，提取 from（充值者）和 value（金额）
3. 写入 deposits 表（充值流水：trader、amount、tx_hash、block_number）
4. 更新 ledger_balances 表（该用户的链下账本余额增加）

------

### Q45. 前端 DealerDepositForm 需要几笔交易才能完成充值？为什么 UsdcDepositForm 只需要一笔？

**DealerDepositForm：2笔交易**

1. USDC.approve(dealerAddress, amount) — 授权 Dealer 合约使用 USDC
2. Dealer.deposit(amount, 0, address) — 执行充值，USDC 从用户钱包转入 Dealer 合约

**UsdcDepositForm：1笔交易**

- USDC.transfer(treasury, amount) — 普通 ERC20 转账，无需 approve（因为不是 transferFrom）

**原因：** Dealer deposit 使用 transferFrom（需要先授权），Treasury transfer 使用 transfer（直接转，不需要授权）。

------

### Q46. 后端 getbalancehandler.go 返回的余额包含了几个来源？如果用户只在 Treasury 充了值但没在 Dealer 充值，前端显示的余额能用来交易吗？

**两个来源：**

1. 链上 primaryCredit（Dealer 合约中的余额）
2. 链下 ledger_balances（Treasury 账本中的余额）

合并公式：primaryMerged = primaryCredit + ledgerAmount

**不能用来交易。** 前端显示的合并余额包含链下部分，但实际交易时只有链上 primaryCredit 有效。智能合约不认识链下账本，用户必须先调用 dealer.deposit() 将资金从 Treasury 转入 Dealer。

------

### Q47. /open-quote 和 /order-preview 接口的区别是什么？它们分别在用户操作的什么环节被调用？

| 接口           | 作用                                          | 调用环节                     |
| -------------- | --------------------------------------------- | ---------------------------- |
| /open-quote    | 返回开仓参考价（做多看卖一价，做空看买一价）  | 用户考虑开仓时，展示预期价格 |
| /order-preview | 下单前的滑点/深度模拟，预估实际成交价格和滑点 | 用户输入订单后、确认下单前   |

------

### Q48. /risk 接口返回的数据对应合约中的哪个函数？前端用它做什么？

**对应合约函数：** getTraderRisk(trader)（在 [MetaNodeView.sol](file:///Users/Ssl80443/contract/perpetual-contract/src/MetaNodeView.sol) 中）

**返回数据：** netValue（净值）、exposure（敞口）、initialMargin（初始保证金）、maintenanceMargin（维持保证金）

**前端用途：**

1. 展示当前保证金率（netValue / exposure）
2. 计算并展示清算价格
3. 风险警告（保证金率接近清算阈值时提醒用户）

------

## 六、综合分析（4题）

### Q49. 如果运营方的 Treasury 地址私钥泄露，用户会有什么损失？Dealer 合约中的资金会受影响吗？为什么？

**用户损失：** Treasury 地址中存放的 USDC 会被攻击者转走。这些是用户通过 Treasury Transfer 方式充值的资金。

**Dealer 合约中的资金不受影响。** 原因：

1. Dealer 合约中的 USDC 由智能合约持有，转账受合约逻辑约束
2. 只有 executeWithdraw/fastWithdraw 等函数才能转出资金，且有权限检查
3. Treasury 私钥泄露只能动 Treasury 地址中的 USDC，无法操作 Dealer 合约

------

### Q50. 假设某用户在 Dealer 合约中有 [*o**bj**ec**tO**bj**ec**t*]10000余额，开了1*BTC*多头仓位（入场价60000），当前标记价格跌到 $55000，维持保证金率为 5%。请判断该用户是否会被清算，并说明计算过程。

**计算过程：**

1. **净值计算：**
   - paper = 1 BTC，credit = -60000（入场时付出资金）
   - netValue = primaryCredit + paper × markPrice + credit
   - netValue = 10000 + 1 × 55000 + (-60000) = 10000 + 55000 - 60000 = **+5000**
2. **维持保证金：**
   - maintenanceMargin = |paper × markPrice| × liquidationThreshold
   - maintenanceMargin = 55000 × 5% = **2750**
3. **判断：**
   - netValue (5000) > maintenanceMargin (2750)
   - **不会被清算**

**结论：** 用户净值 

[*o**bj**ec**tO**bj**ec**t*]

5000仍大于维持保证金2750，不会被清算。当净值跌破 

[*o**bj**ec**tO**bj**ec**t*]

2750时（即价格继续下跌到约

2750 以下），才会触发清算。



------

### Q51. 如果 orderSender（撮合引擎）地址被攻击者控制，攻击者能做什么？不能做什么？如何防范？

**攻击者能做的：**

1. **选择性提交订单**：延迟提交或不提交某些订单，操纵成交时机
2. **抢跑**：看到其他用户订单后，优先提交自己的订单套利
3. **手续费操纵**：通过构造特定交易收取更多手续费
4. **无效订单提交**：提交无效撮合数据（但会被合约验证拒绝）

**攻击者不能做的：**

1. **不能伪造签名**：所有订单需要有效签名，攻击者无法替用户签名
2. **不能修改仓位**：余额变化由合约计算，攻击者无法篡改
3. **不能直接转走资金**：资金由合约持有，取款需要用户发起
4. **不能修改合约逻辑**：合约代码不可变

**防范措施：**

1. 定期更换 orderSender 地址
2. 多签控制（使用多签钱包作为 orderSender）
3. 监控异常交易模式
4. 代码审计确保逻辑无漏洞

------

### Q52. 这个项目的设计理念是"链下撮合 + 链上结算"，相比于纯链上撮合（如 Uniswap V3）有什么优缺点？

| 维度     | 链下撮合 + 链上结算                                          | 纯链上撮合（Uniswap V3）                             |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| **优点** | 高吞吐量（不受区块 TPS 限制）、低延迟、用户体验好、gas 成本低（批量结算） | 完全去中心化、无需信任任何方、透明度高               |
| **缺点** | 需信任撮合引擎、链下系统单点故障风险、透明度不如链上、抢跑风险 | 吞吐量受区块限制、延迟高、gas 成本高、大额交易滑点大 |

**核心区别：**

- 链下撮合：性能优先，信任假设弱化（信任撮合引擎不作恶）
- 纯链上撮合：去中心化优先，性能妥协

**适用场景：**

- 链下撮合：高频交易、衍生品（需要复杂订单类型和低延迟）
- 纯链上撮合：现货交易、长期持有（更注重去中心化）

------