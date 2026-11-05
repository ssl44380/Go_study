- # NFT 交易市场项目（EasySwap）掌握程度测试卷
  考试说明 ：本卷共 6 部分、50 题，覆盖项目全部模块。建议用时 120 分钟，闭卷作答。

  ## 第一部分：项目总体架构（共 6 题）
  1. 本项目由哪几个子服务/仓库组成？请分别说明它们的职责，以及相互之间的依赖关系。
  2. 项目的三个核心微服务（API 服务、交易同步服务、NFT 导入服务）各自解决什么问题？它们之间的数据流是怎样的？
  3. 本项目的 NFT 数据模型包含哪几个核心实体（Collection、Item、Ownership、Order、Activity）？请说明每个实体的含义及其相互关系。
  4. 项目同时涉及“链上订单簿”与“链下订单”两种模式，请说明本项目采用的是哪种模式，链下服务承担了哪些链上无法完成的工作？
  5. 三个 Go 服务（Backend、Base、Sync）在`go.mod` 中是如何建立本地依赖的？部署一个完整环境需要按什么顺序准备哪些外部组件（数据库、缓存、RPC 节点、合约）？
  6. 为什么合约部署后要把订单簿合约地址同时配置到 Backend 和 Sync 的配置文件中？缺少任一配置会导致什么现象？
  ## 第二部分：智能合约模块（EasySwapContract）（共 16 题）
  ### （一）选择题
  7. `EasySwapOrderBook` 支持的两种订单方向（Side）是：
     - A. Buy / Sell　　B. List / Bid　　C. Ask / Offer　　D. Mint / Burn
  8. `LibOrder.SaleKind` 枚举包含的两种销售类型是：
     - A. 按件定价 / 按捆绑定价　　B. FixedPriceForCollection / FixedPriceForItem　　C. EnglishAuction / DutchAuction　　D. Once / Always
  9. `OrderKey` 的底层类型是：
     - A. uint256　　B. address　　C. bytes32　　D. string
  10. `OrderKey` 的生成方式是：
      - A. 自增计数器　　B. 对订单结构体做 EIP712 风格哈希（`abi.encodePacked` 拼接 TYPEHASH）　　C. maker 地址与 tokenId 拼接　　D. 随机数 salt 本身
  11. 同一价格下多个订单的存储结构`OrderQueue` 使用的是：
      - A. 动态数组　　B. 双向链表（head/tail 指针）　　C. 映射＋计数器　　D. 堆（heap）
  12. 价格排序所使用的数据结构是：
      - A. 有序数组　　B. 跳表　　C. 红黑树（RedBlackTreeLibrary）　　D. 最小堆
  ### （二）填空题
  13. 红黑树库中`Price` 是基于`uint128` 的自定义类型，插入/删除/查找的时间复杂度为 ______；要获取当前最高 Bid 价格应调用 ______ 函数，获取最低 List 价格应调用 ______ 函数。
  14. 卖家挂单（List）成功后，NFT 从卖家地址转入 ______ 合约托管；买家出价（Bid）成功后，ETH 存入 ______ 合约。
  15. `EasySwapVault` 中`depositNFT` 依赖 ERC721 的 ______ 回调钩子完成入账，该函数必须校验调用来源是 ______ 才能正确记账。
  16. 订单验证（EIP712 签名）由 ______ 合约负责，其初始化时需要传入 EIP712 的 ______ 和 ______ 两个域参数。
  ### （三）判断改错题
  17. `EasySwapOrderBook` 使用`initializer` 修饰符初始化，因此它是一个不可升级的普通合约。（　）
  18. 批量匹配订单通过`onlyDelegateCall` 修饰符限制函数只能以 delegatecall 方式调用，这样做的目的是让内部 revert 不回滚外层主流程，并通过`BatchMatchInnerError` 事件记录失败。（　）
  19. `multicall` 中某个子调用失败会导致整个 multicall 回滚。（　）
  20. 出现订单创建/取消失败时会触发`LogSkipOrder` 事件而不是直接 revert。（　）
  ### （四）简答题
  21. 请完整描述一笔“卖家挂单 → 买家出价 → 匹配成交”在链上的调用流程（涉及哪些合约、哪些函数、资产如何流转、手续费如何计算与分配）。
  22. `LibPayInfo` 的作用是什么？匹配成交时买方与卖方的付款信息（PayInfo）是如何校验和使用的？
  23. 卖家想修改已挂单的价格，应调用哪个函数？`EditDetail` 结构体中`oldOrderKey` 和`newOrder` 分别起什么作用？编辑对链表与红黑树数据结构分别做了什么操作？
  24. `ProtocolManager` 负责什么？协议费比例存储在哪里？项目中的`ProtocolManagerV2Test` 暗示该合约经历过怎样的升级演进？
  25. 合约层面的安全机制有哪些？请分别说明`ReentrancyGuard` 、`Pausable` 、`LibTransferSafeUpgradeable` 、自定义`self` 地址检查（delegatecall 校验）各自防的是什么攻击/风险。
  26. 脚本`updateUseUpgradeProxy.js` 和`verify-orderbook-impl.js` 分别用于什么场景？升级代理合约时最需要防止的操作错误是什么？
  ## 第三部分：后端 API 模块（EasySwapBackend）（共 12 题）
  ### （一）选择题
  27. Backend 的分层架构自外向内依次是：
      - A. dao → service → api → types　　B. api → service → dao → types　　C. service → api → types → dao　　D. api → dao → service
  28. 路由层`router/v1.go` 中订单相关的接口前缀挂载在哪个分组下，中间件（auth/cache/logger/recover）的注册位置在：
      - A. dao 层　　B. gin Engine 全局与路由分组　　C. main.go 手动调用　　D. 配置文件声明
  29. 数据库`ob_order` 表中`order_type` 字段的取值含义是：
      - A. 1:listing 2:offer 3:collection bid 4:item bid　　B. 1:buy 2:sell 3:cancel 4:match　　C. 0:open 1:filled 2:expired　　D. 与订单方向无关的随机值
  ### （二）填空题
  30. 中间件`auth.go` 主要完成 ______ 的校验；`cacheapi.go` 实现的是 ______ 功能，用于降低数据库压力。
  31. service 层获取订单列表时，订单的状态来源于 ______ 服务同步的链上事件，API 本身 ______（填“会”或“不会”）直接与合约交互发起交易。
  32. `types/v1` 目录下的结构体文件（order.go、collection.go 等）主要用于定义 API 层的 ______ 与 ______，与 dao 层的 model 相互隔离。
  ### （三）简答题
  33. 请描述一次“用户在页面查询某 Collection 的在售 NFT 列表”从 HTTP 请求到数据库查询的完整链路（经过哪些文件/函数，各层做什么）。
  34. `portfolio.go` （资产组合）与`portfolio_import.go` 支持什么功能？导入外部钱包资产的数据来源可能是什么？
  35. `ranking.go` （排行榜）接口的数据从哪张表/哪个服务来？为什么排行榜不适合由 API 服务实时计算？
  36. MQ 相关代码（`service/mq/metadata.go` ）在 Backend 中承担什么职责？什么场景下需要引入消息队列？
  37. `common/utils` 中的`crypto.go` 、`retry.go` 分别被哪些业务场景使用？
  38. Swagger 文件（docs/）是如何生成的？新加接口后开发者需要做什么才能让文档生效？
  ## 第四部分：公共基础库模块（EasySwapBase）（共 8 题）
  39. `ordermanager` 包是本项目的核心共享业务组件，请说明其中四个文件各自的职责：`expiredorder.go` 、`floorprice.go` 、`listcount.go` 、`queue.go` 。
  40. `stores/gdb/orderbookmodel` 分为`base` 与`multi` 两个子包，两者的表模型差异是什么？表名（如`ob_order_sepolia` ）是如何按链动态生成的（提示：`tablename.go` ）？
  41. `stores/xkv` 封装的是什么中间件？在 Sync/Backend 中分别被用来做什么（如高度游标、缓存）？
  42. `chain/nftchainservice` 中`transferevent.go` 与`bind_erc721` 的作用分别是什么？`CheckNFTApprovalStatus` 的能力最终依赖此包的哪个部分？
  43. `evm/eip/eip55.go` 解决什么问题？为什么地址校验和对系统安全很重要？
  44. `logger/xzap` 封装了 zap 日志，并针对 gRPC 和 HTTP 各提供了什么能力（提示：interceptors）？日志上下文（context）是如何透传 trace 信息的？
  45. `retry` 包中`retry.go` 与`strategy.go` 的关系是什么？列举一个项目中最需要重试机制的外部调用场景。
  46. `kit/slice` 、`kit/math` 、`kit/convert` 这类工具包在项目中大量使用，请各举一个真实业务用法（如对订单列表去重、价格精度换算等）。
  ## 第五部分：同步服务模块（EasySwapSync）（共 8 题）
  47. `SyncOrderBookEventLoop` 的工作原理是什么？请说明它如何确定起止区块（游标存在哪里）、如何拉取日志（`chainclient/evmclient` ）、以及`circularsleep.go` 在其中起什么作用。
  48. 同步服务监听到`LogMake` /`LogCancel` /`LogMatch` 事件后，分别会更新数据库中哪些表、哪些字段（结合`model/model.go` 与`db/migrations/01_create.sql` ）？
  49. `UpKeepingCollectionFloorChangeLoop` 与`QueryCollectionsFloorPrice` 解决什么问题？地板价变化为什么需要定时维护而不是完全事件驱动？
  50. 以下三道小题基于同步服务综合场景：
      - a)`CanMarketBuyNFT` 返回`(bool, string, error)` 三元值，请推测其三种返回分别对应什么业务语义（能否购买、不可购买原因、系统错误）？
      - b)`collectionfilter` （`filter.go` ）在导入 Collection 时过滤的是什么内容？为什么需要白名单/黑名单机制？
      - c) 若同步服务停机 2 小时后重启，事件会不会丢？会不会重复入库？项目中靠什么机制保证“至少一次/恰好一次”处理？
  ## 附录：实操附加题（选做，不占分）
  1. 从零跑通本项目：按顺序列出你需要执行的命令（启动 MySQL/Redis → 建表 → 部署合约 → 修改三份 config.toml → 分别启动 Sync 与 Backend），并截图/描述验证成功的标志。
  2. 在`TestEasySwap.js` 基础上，用 Hardhat 写一个测试用例：卖家挂单后以更高价格编辑订单，再由买家出价成交，断言最终卖家的 ETH 余额增量是否正确扣除了协议费。
  3. 给`EasySwapOrderBook` 增加一个“批量取消订单”函数（循环调用现有取消逻辑），说明你需要考虑的重入、gas 上限与事件顺序问题。