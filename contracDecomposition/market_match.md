# market_match 项目拆解

## 整体流程

### 整体流程图


```mermaid
flowchart TB
    subgraph external["🖥️ 外部系统层"]
        client["👤 客户端/APP/API"]
        mq["🐰 RabbitMQ\n消息队列"]
        redis["📦 Redis\n缓存集群"]
        mysql["🗄️ MySQL\n数据库"]
    end

    subgraph engine["⚙️ 撮合引擎核心"]
        subgraph pull["📥 数据拉取层"]
            puller["🔄 Puller\n拉取器"]
            validator["✅ Validator\n验证器"]
        end

        subgraph core["🎯 撮合核心层"]
            subgraph orderbook["📚 订单簿（每交易对独立）"]
                ob_btc["₿ BTC/USDT\n订单簿"]
                ob_eth["Ξ ETH/USDT\n订单簿"]
                ob_sol["◎ SOL/USDT\n订单簿"]
            end
            matcher["⚡ Matcher\n撮合器"]
            order["📋 Order\n订单"]
        end

        subgraph market["📊 市场数据层"]
            l2quote["📈 L2Quote\n行情服务"]
            market_module["📉 Market\n市场深度"]
            depth["📐 Depth\n深度数据"]
        end

        subgraph process["💾 数据处理层"]
            snapshotter["📸 Snapshotter\n快照管理"]
            persistence["💿 Persistence\n持久化"]
            statistics["📊 Statistics\n统计"]
        end
    end

    client -->|"1. 提交订单"| mq
    mq -->|"2. 拉取订单"| puller
    puller -->|"3. 订单验证"| validator
    validator -->|"4. 发送订单"| matcher
    matcher <-->|"5. 订单撮合"| orderbook
    matcher -->|"6. 成交结果"| l2quote
    matcher -->|"7. 成交记录"| persistence
    matcher -->|"8. 市场深度"| market_module
    l2quote -->|"9. 行情缓存"| redis
    l2quote -->|"10. 行情发布"| mq
    persistence -->|"11. 持久化"| mysql
    matcher -.->|"12. 定时快照"| snapshotter
    snapshotter -.->|"13. 恢复订单簿"| orderbook

    style client fill:#1976d2,color:#fff,stroke:#1565c0,stroke-width:3px
    style mq fill:#f57c00,color:#fff,stroke:#e65100,stroke-width:3px
    style redis fill:#7b1fa2,color:#fff,stroke:#6a1b9a,stroke-width:3px
    style mysql fill:#388e3c,color:#fff,stroke:#2e7d32,stroke-width:3px

    style puller fill:#0288d1,color:#fff,stroke:#0277bd,stroke-width:2px
    style validator fill:#0288d1,color:#fff,stroke:#0277bd,stroke-width:2px
    style matcher fill:#388e3c,color:#fff,stroke:#2e7d32,stroke-width:2px

    style ob_btc fill:#f9a825,color:#fff,stroke:#f57f17,stroke-width:2px
    style ob_eth fill:#f9a825,color:#fff,stroke:#f57f17,stroke-width:2px
    style ob_sol fill:#f9a825,color:#fff,stroke:#f57f17,stroke-width:2px

    style l2quote fill:#c2185b,color:#fff,stroke:#ad1457,stroke-width:2px
    style market_module fill:#c2185b,color:#fff,stroke:#ad1457,stroke-width:2px
    style depth fill:#c2185b,color:#fff,stroke:#ad1457,stroke-width:2px

    style snapshotter fill:#00695c,color:#fff,stroke:#004d40,stroke-width:2px
    style persistence fill:#00695c,color:#fff,stroke:#004d40,stroke-width:2px
    style statistics fill:#00695c,color:#fff,stroke:#004d40,stroke-width:2px
```

### 架构组成

**外部系统层：**

客户端 API：客户与交易系统交互入口

RabbiMQ：消息队列，负责建立通道，传递消息

Reids：缓存数据，保存快照

Mysql：持久化出具，存储用户信息，交易信息

**数据拉取层：**

Puller：负责将数据库中的数据按照指定的顺序批次拉取到撮合系统中进行撮合

validatore：验证器，校验系统开启或者重启后状态是否一致

**数据处理层：**

Persistence：持久化数据，并将持久化的数据存入 mysql

Snapshotter：快照生成器，负责生成快照，上传快照，下载快照

Statistic：统计器，负责记录各个处理时间的过程节点中，系统处理耗时情况，任务积压情况

**市场数据层：**

Depth：从订单簿拿数据买卖盘深度信息，支持多级深度，实时计算当前盘口深度，批量打包深度信息

Market：消费 Depth 数据，批量打包最多 90 条数据，通过RabbitMQ 发给前端，定时推送，监控性能

L2Quote：生成 K 线，Ticker 数据，缓存查询数据到 redis，向 MQ 发送实情推送，保存和恢复行情

**撮合核心层：**

Matcher：核心执行撮合订单，根据不同的订单类型和策略执行撮合

OrderBook：撮合器依赖的底层数据，记录当前的所有买卖盘信息，可从快照中恢复

### 运行流程

~~~mermaid

flowchart TB
    start([🚀 系统启动]) --> config["⚙️ 加载配置"]
    config --> init["🔧 初始化组件\n日志/统计/快照\nRedis/RabbitMQ\n撮合引擎/市场模块"]
    init --> load_symbols["📋 加载交易对列表\nBTC/USDT\nETH/USDT\nSOL/USDT"]
    load_symbols --> loop_symbol{"🔄 遍历交易对"}

    loop_symbol --> check_snapshot{"📸 检查快照\n./sp/"}

    check_snapshot -->|"Yes"| load_snapshot["📂 加载快照\nGob反序列化"]
    check_snapshot -->|"No"| create_empty["🆕 创建空订单簿\nFromId = 0"]

    load_snapshot --> get_lastid["🔢 获取最后订单ID"]
    create_empty --> get_lastid

    get_lastid --> init_puller["🔄 初始化拉取器\n从lastId+1开始拉取"]
    init_puller --> start_matcher["⚡ 启动撮合器\n单线程处理"]
    start_matcher --> start_l2quote["📈 启动L2行情服务\n并行计算K线"]
    start_l2quote --> start_mq["🐰 启动行情推送\n定时批量发送"]

    start_mq -.-> snapshot_scheduler["📸 启动快照调度器\n每60秒保存一次"]
    start_mq --> ready([✅ 系统就绪\n开始接收订单])

    style start fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style ready fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style config fill:#2196f3,color:#fff,stroke:#1976d2,stroke-width:3px
    style init fill:#2196f3,color:#fff,stroke:#1976d2,stroke-width:3px
    style load_symbols fill:#2196f3,color:#fff,stroke:#1976d2,stroke-width:3px
    style loop_symbol fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
    style check_snapshot fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
    style load_snapshot fill:#8bc34a,color:#fff,stroke:#689f38,stroke-width:3px
    style create_empty fill:#f44336,color:#fff,stroke:#d32f2f,stroke-width:3px
    style init_puller fill:#9c27b0,color:#fff,stroke:#7b1fa2,stroke-width:3px
    style start_matcher fill:#9c27b0,color:#fff,stroke:#7b1fa2,stroke-width:3px
    style start_l2quote fill:#9c27b0,color:#fff,stroke:#7b1fa2,stroke-width:3px
    style start_mq fill:#9c27b0,color:#fff,stroke:#7b1fa2,stroke-width:3px
    style snapshot_scheduler fill:#00bcd4,color:#fff,stroke:#0097a7,stroke-width:3px
~~~



整个撮合系统的运行流程：

1. 启动配置项
2. 启动并注册http 和端口号
3. 启动日志组件
4. 启动统计模块即性能模块
5. 启动并初始化快照模块，获取s3manager.NewUploader
6. 启动 redis 缓存系统
7. 启动rabbitmq 消息传送通道模块
8. 初始化match 撮合模块
9. 启动 maket 市场模块
10. 启动Exchange，开始执行撮合
11. 启动校验器模块，校验器模块主要作用为验证系统重启后数据是否发生了变动
12. 自循环，开始服务

## 数据流程

### 数据流程图

```mermaid
flowchart LR
    client["👤 客户端"] -->|"提交订单"| mq["🐰 RabbitMQ"]
    mq -->|"拉取订单\nWHERE id>=N\nORDER BY id ASC"| puller["🔄 Puller"]
    puller -->|"订单验证"| validator["⚡ Matcher"]
    matcher <-->|"查找对手方\n更新订单簿"| orderbook["📚 OrderBook"]
    matcher -->|"生成成交结果"| l2quote["📈 L2Quote"]
    l2quote -->|"更新缓存"| redis["📦 Redis"]
    matcher -->|"持久化成交记录"| mysql["🗄️ MySQL"]
    matcher -.->|"定时保存快照"| snapshot["📸 Snapshotter"]
    snapshot -.->|"重启恢复"| orderbook

    style client fill:#1976d2,color:#fff,stroke:#1565c0,stroke-width:4px
    style mq fill:#f57c00,color:#fff,stroke:#e65100,stroke-width:4px
    style puller fill:#0288d1,color:#fff,stroke:#0277bd,stroke-width:4px
    style validator fill:#0288d1,color:#fff,stroke:#0277bd,stroke-width:4px
    style matcher fill:#388e3c,color:#fff,stroke:#2e7d32,stroke-width:4px
    style orderbook fill:#f9a825,color:#fff,stroke:#f57f17,stroke-width:4px
    style l2quote fill:#c2185b,color:#fff,stroke:#ad1457,stroke-width:4px
    style redis fill:#7b1fa2,color:#fff,stroke:#6a1b9a,stroke-width:4px
    style mysql fill:#388e3c,color:#fff,stroke:#2e7d32,stroke-width:4px
    style snapshot fill:#00695c,color:#fff,stroke:#004d40,stroke-width:3px
```

### 多分片数据流转

~~~mermaid

flowchart TB
    subgraph shared["🔗 共享资源"]
        MySQL["🗄️ MySQL数据库"]
        Redis["📦 Redis缓存"]
        MQ["🐰 RabbitMQ"]
    end

    subgraph btc["₿ BTC/USDT 分片"]
        BTC_Ch["📨 Channel\n容量5000"]
        BTC_Puller["🔄 Puller"]
        BTC_Matcher["⚡ Matcher\n单线程"]
        BTC_Book["📚 OrderBook\n订单簿"]
    end

    subgraph eth["Ξ ETH/USDT 分片"]
        ETH_Ch["📨 Channel\n容量5000"]
        ETH_Puller["🔄 Puller"]
        ETH_Matcher["⚡ Matcher\n单线程"]
        ETH_Book["📚 OrderBook\n订单簿"]
    end

    subgraph sol["◎ SOL/USDT 分片"]
        SOL_Ch["📨 Channel\n容量5000"]
        SOL_Puller["🔄 Puller"]
        SOL_Matcher["⚡ Matcher\n单线程"]
        SOL_Book["📚 OrderBook\n订单簿"]
    end

    MySQL --> BTC_Puller
    MySQL --> ETH_Puller
    MySQL --> SOL_Puller

    BTC_Puller --> BTC_Ch
    BTC_Ch --> BTC_Matcher
    BTC_Matcher --> BTC_Book

    ETH_Puller --> ETH_Ch
    ETH_Ch --> ETH_Matcher
    ETH_Matcher --> ETH_Book

    SOL_Puller --> SOL_Ch
    SOL_Ch --> SOL_Matcher
    SOL_Matcher --> SOL_Book

    BTC_Matcher --> shared
    ETH_Matcher --> shared
    SOL_Matcher --> shared

    style btc fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style eth fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px
    style sol fill:#fff8e1,stroke:#f9a825,stroke-width:3px
    style shared fill:#e8f5e9,stroke:#388e3c,stroke-width:3px
~~~





### 数据流转过程

1. 用户提交订单，
2. RabbiMQ 通过分片识别它归属于那个片区，并将数据存放到数据库中，主键为自增 id
3. puller 定时从数据库中拉取订单，并将订单发送给撮合器
4. 撮合器按照订单的类型和指定的策略进行撮合
5. 撮合结果 序列化为 json 字符串
6. 定时将一批序列化订单结构体信息及成交结果发送给行情通道中，将序列化交易结果发从给持久化数据库和订阅客户端，定时保存并上传新的快照

## 订单撮合流程

### 订单撮合流程图





```mermaid

flowchart TB
    start([🟢 开始]) --> input["📥 接收订单<br/>SeqId, OrderId, Type,<br/>Price, Amount"]
    input --> type_check{"🎯 订单类型?"}

    type_check -->|"限价"| limit["📋 限价单"]
    type_check -->|"市价"| market["⚡ 市价单"]
    type_check -->|"IOC"| ioc["⏱️ IOC单"]
    type_check -->|"FOK"| fok["🔒 FOK单"]
    type_check -->|"取消"| cancel["❌ 取消单"]

    limit --> price_check{"💰 价格匹配?<br/>买价 ≥ 卖价?"}
    market --> price_check
    ioc --> price_check
    fok --> price_check

    price_check -->|"Yes"| time_check{"⏰ 时间优先?<br/>同价SeqId小"}
    price_check -->|"No"| no_match["📌 挂单到订单簿"]

    time_check -->|"Yes"| execute["⚡ 执行成交<br/>计算手续费"]
    time_check -->|"No"| no_match

    execute --> update["📚 更新订单簿<br/>移除/修改订单"]
    update --> generate["✅ 生成成交结果"]
    cancel --> update

    generate --> output_result["📊 MatchResult<br/>成交记录"]
    generate --> output_depth["📈 深度更新"]
    generate --> output_snapshot["📸 快照保存"]

    no_match --> output_depth
    no_match --> output_snapshot

    output_result --> finish([🟢 结束])
    output_depth --> finish
    output_snapshot --> finish

    style start fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:3px
    style finish fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:3px
    style input fill:#2196f3,color:#fff,stroke:#1976d2,stroke-width:3px
    style type_check fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
    style price_check fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
    style time_check fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
    style execute fill:#8bc34a,color:#fff,stroke:#689f38,stroke-width:3px
    style update fill:#8bc34a,color:#fff,stroke:#689f38,stroke-width:3px
    style generate fill:#8bc34a,color:#fff,stroke:#689f38,stroke-width:3px
    style no_match fill:#f44336,color:#fff,stroke:#d32f2f,stroke-width:3px
    style output_result fill:#9c27b0,color:#fff,stroke:#7b1fa2,stroke-width:3px
    style output_depth fill:#9c27b0,color:#fff,stroke:#7b1fa2,stroke-width:3px
    style output_snapshot fill:#9c27b0,color:#fff,stroke:#7b1fa2,stroke-width:3px


```



~~~mermaid

sequenceDiagram
    participant C as 👤 客户端
    participant MQ as 🐰 RabbitMQ
    participant P as 🔄 Puller
    participant V as ✅ Validator
    participant M as ⚡ Matcher
    participant OB as 📚 OrderBook
    participant L2 as 📈 L2Quote
    participant R as 📦 Redis
    participant DB as 🗄️ MySQL

    rect rgb(200, 220, 255)
        Note over C,DB: 📝 阶段1：订单提交
    end

    C->>MQ: 1️⃣ 提交订单
    Note over MQ: 包含：SeqId, OrderId,<br/>UserId, Type, Price, Amount

    rect rgb(220, 255, 220)
        Note over MQ,DB: 📥 阶段2：订单拉取
    end

    MQ->>P: 2️⃣ Puller拉取
    Note over P: WHERE id >= N<br/>ORDER BY id ASC<br/>limit 2000

    P->>V: 3️⃣ 验证订单
    Note over V: 检查格式、余额、权限

    rect rgb(255, 240, 200)
        Note over V,DB: ⚡ 阶段3：订单撮合
    end

    alt ✅ 验证通过
        V->>M: 4️⃣ 发送订单
        M->>OB: 5️⃣ 查找对手方

        alt 🎯 找到匹配
            OB-->>M: 6️⃣ 返回匹配订单
            M->>M: 7️⃣ 执行撮合
            M->>OB: 8️⃣ 更新订单簿

            rect rgb(240, 220, 255)
                Note over M,R: 📊 阶段4：结果处理
            end

            M->>L2: 9️⃣ 生成成交数据
            L2->>R: 🔟 更新Redis缓存
            M->>DB: 1️⃣1️⃣ 持久化成交记录
            M->>MQ: 1️⃣2️⃣ 发布成交结果
        else ❌ 无匹配
            M->>OB: 6️⃣ 挂单
            M->>L2: 7️⃣ 更新深度
            L2->>R: 8️⃣ 更新缓存
        end

        rect rgb(255, 220, 220)
            Note over M,R: 📸 阶段5：快照保存
        end

        M-.->>OB: 1️⃣3️⃣ 定时保存快照
        OB-.->>M: 1️⃣4️⃣ 重启恢复

    else ❌ 验证失败
        V->>MQ: 4️⃣ 返回错误
    end
~~~





### 订单状态

| 常量                        | 字符串                      | 含义说明                                                     | 典型来源                                                     |
| --------------------------- | --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| submittedState              | submitted                   | **已挂单（未成交）**订单成功进入订单簿，还没有任何成交。     | 限价 Maker 单成功挂簿                                        |
| partialFilledState          | partial-filled              | **部分成交**已经成交一部分，还有余量留在订单簿，可以继续被撮合。 | 限价单被吃掉一部分，剩余还在盘上                             |
| filledState                 | filled                      | **全部成交**订单余量全部吃完，订单结束，移出订单簿。         | 正常撮合，全部匹配完成                                       |
| canceledState               | canceled                    | **正常撤销（完全撤销）**原本是 submitted，一笔都没成交，被用户 / 系统撤单，直接取消。 | 用户单笔撤单、系统撤单，订单从未成交                         |
| partialCancelState          | partial-canceled            | **部分撤销**之前已经有一部分成交，剩下没成交的余量被撤销。   | 一个单子部分成交之后，再发起撤单                             |
| failedState                 | failed                      | **撤销失败**发了撤单指令，但是在订单簿找不到这个订单：已经成交、已经撤过、单号不存在。 | matchCancel /matchBatchCancel 里面的 else 分支               |
| precisionCancelState        | precision-canceled          | **精度不足取消**cash 市价买场景：剩余资金不够买**最小交易单位**，直接取消这笔 taker 单，不进簿、不成交。 | 你刚才看的 `unitPrice.GreaterThan(order.UnfilledAmount)` 分支 |
| circuitCancelState          | circuit-canceled            | **熔断取消 / 风控回路取消**行情熔断、风控触发，订单被平台风控取消。 | 全局行情熔断、风控开关触发                                   |
| selfTradeDecreaseState      | self-trade-decreased        | **自成交减量（DC），还有余量**STP-DC 模式，同用户订单碰撞，不真实成交，只扣减一部分余量，订单还有剩余，继续留在簿 / 继续撮合。 | DC 分支，maker 扣一部分、还剩余量留在簿                      |
| selfTradePartialCancelState | self-trade-partial-canceled | **自成交减量后余量耗尽，订单结束**DC 自成交减量扣完之后，余量归零，订单生命周期结束。对应你 `stOrderState()` 流转目标态。 | DC：taker 或者 maker 被 DC 扣干净了                          |
| selfTradeCancelState        | self-trade-canceled         | **自成交直接取消（CB 模式）**STP-CB：同用户碰撞，两边直接取消，不成交、不减量，直接作废。 | CB 策略，碰撞后双向取消                                      |

**区分点**：

**普通撤单和自成交撤单**：

- `canceledState` / `partialCancelState`：**正常用户 / 系统撤单链路（matchCancel、matchBatchCancel）**
- `selfTradeCancelState` / `selfTradePartialCancelState` / `selfTradeDecreaseState`：**撮合碰撞瞬间 STP 自成交逻辑产生，不是外部下发撤单指令**

**partial-filled（正常部分成交） 和 self-trade-decreased（DC 减量）**

- `partial-filled`：真实成交，有资产划转、计入 K 线
- `self-trade-decreased`：DC 自成交，**只是扣订单内部余量，不发生真实资产交割，下游账户模块要跳过记账**

**precision-canceled** 

和普通 cancel 完全不一样：它不是撤单，是**订单进来撮合的时候，前置校验就判定买不起最小单位，直接作废**，订单从来没有进订单簿。

### 订单分类

#### 限价单

只有达到指定的价格才成交

~~~mermaid

flowchart TB
    subgraph Title["📋 限价单撮合详细流程 matchLimit()"]
    end

    START([开始 matchLimit]) --> LOOP1{"循环检查<br/>order.isFilled() ||<br/>order.isSelfTrade()?"}

    LOOP1 -->|"True|已成交或自成交"| RETURN1["finalizeTaker(order)<br/>返回taker结果"]
    RETURN1 --> END([结束])

    LOOP1 -->|"False|继续撮合"| PEEK["oppoOrder := peekOppoOrder(order)<br/>获取最佳对手单"]

    PEEK --> CHECK_OPPO{"oppoOrder == nil ||<br/>!matchAble(order, oppoOrder)"}

    CHECK_OPPO -->|"True|无对手单或价格不匹配"| ENQUEUE["book.Enqueue(order)<br/>挂单到订单簿"]

    ENQUEUE --> RETURN2["finalizeTaker(order)<br/>返回taker结果"]
    RETURN2 --> END

    CHECK_OPPO -->|"False|价格可匹配"| MATCH["tmpOrderResult := matchOrder(book, order, oppoOrder)<br/>执行撮合"]

    MATCH --> CHECK_RESULT{"tmpOrderResult != nil?"}

    CHECK_RESULT -->|"False|精度取消"| LOOP1

    CHECK_RESULT -->|"True|撮合成功"| APPEND1["results = append(results, tmpOrderResult)<br/>添加成交结果"]

    APPEND1 --> CHECK_OPPO_STATE{"oppoOrder状态检查<br/>isFilled() ||<br/>isSelfTradeCanceled() ||<br/>isSelfTradePartialCanceled()"}

    CHECK_OPPO_STATE -->|"True|对手单完成"| DEQUEUE["book.Dequeue(oppoOrder.OrderId)<br/>对手单出队"]

    DEQUEUE --> CHECK_PRICE{"oppoOrder.isFilled() ||<br/>oppoOrder.isPartialFilled()"}

    CHECK_PRICE -->|"True|成交或部分成交"| UPDATE_PRICE["price = oppoOrder.Price<br/>更新成交价格"]

    UPDATE_PRICE --> LOOP1

    CHECK_PRICE -->|"False|未成交"| LOOP1

    CHECK_OPPO_STATE -->|"False|对手单未完成"| CHECK_PRICE

    style START fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style END fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style ENQUEUE fill:#f44336,color:#fff,stroke:#d32f2f,stroke-width:3px
    style MATCH fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
~~~

订单流转过程：

1. 检查 taker 状态是否为已成交，自撤销，部分自撤销，append(results, finalizeTaker(order))，break
2. 如果不是，取对手单
3. 如果对手单不存在，或者不匹配，则将该订单挂到订单簿中，append(results, finalizeTaker(order))，break
4. 否则执行撮合，获得撮合结果
5. 如果撮合结果为 nil，append(results, tmpOrderResult)
6. 否则，continue（这个场景适用于匹配到的对手单也是自己发起的，按照自成交策略，返回空）
7. 检查对手单状态是否为完全成交，自撤销，部分自撤销，如果是则下架该maker 单
8. 同时检查如果对手单状态是完成成交或者部分成交，则将对手单的价格设置为返回值中的价格

代码实现：

~~~
/* @notion 撮合限价单
* @param  order  输入 taker 订单
* @return price  撮合价格
* @return results  撮合成功的订单列表
*/
func (book *OrderBook) matchLimit(order *Order) (price decimal.Decimal, results []*OrderResult) 
进入自循环
首先检查taker订单状态，是否已成交，自撤销，部分自撤单。如果是，将结果加入到最终 results 订单列表中，返回结果
	如果不是，找到最合适的对手单
	检查对手单是否存在，对手单和 taker 单是否匹配
		如果不匹配或者没有对手单将限价单加入挂单队列中，并将结果加入到results列表中，中断循环
		如果匹配，执行撮合
			如果撮合结果不等于 nil，将撮合结果加入到results列表中
			如果结果为 nil，则跳出循环，继续执行上述过程
		检查对手单状态是否已经成交完毕，是否有自撤单，时候有部分撤单，
			将maker 单从队列中删除掉
		如果对手单是成交，或者部分成交，将成交价设置为基price



~~~



#### 市价单

按照盘口市价吃单，如果吃完所有还有剩余则挂在盘口

~~~mermaid

flowchart TB
    subgraph Title["📊 市价单撮合详细流程 matchMarket()"]
    end

    START([开始 matchMarket]) --> LOOP1{"循环检查<br/>order.isFilled() ||<br/>order.isSelfTrade()?"}

    LOOP1 -->|"True|已成交或自成交"| RETURN1["finalizeTaker(order)<br/>返回taker结果"]
    RETURN1 --> END([结束])

    LOOP1 -->|"False|继续撮合"| PEEK["oppoOrder := peekOppoOrder(order)<br/>获取最佳对手单"]

    PEEK --> CHECK_OPPO{"oppoOrder == nil?"}

    CHECK_OPPO -->|"True|无对手单"| RETURN2["finalizeTaker(order)<br/>市价单直接返回"]
    RETURN2 --> END

    CHECK_OPPO -->|"False|有对手单"| CHECK_CIRCUIT{"len(results) > 0 &&<br/>!order.CircuitRate.Equals(0) &&<br/>价格超出熔断范围?"}

    CHECK_CIRCUIT -->|"True|触发熔断"| RETURN3["finalizeTaker(order.SetState(CircuitCanceled))<br/>熔断取消"]
    RETURN3 --> END

    CHECK_CIRCUIT -->|"False|未触发熔断"| MATCH["tmpOrderResult := matchOrder(book, order, oppoOrder)<br/>执行撮合"]

    MATCH --> CHECK_RESULT{"tmpOrderResult != nil?"}

    CHECK_RESULT -->|"False|精度取消"| RETURN4["finalizeTaker(order.SetState(PrecisionCanceled))<br/>精度取消"]
    RETURN4 --> END

    CHECK_RESULT -->|"True|撮合成功"| APPEND1["results = append(results, tmpOrderResult)<br/>添加成交结果"]

    APPEND1 --> CHECK_OPPO_STATE{"oppoOrder状态检查<br/>isFilled() ||<br/>isSelfTradeCanceled() ||<br/>isSelfTradePartialCanceled()"}

    CHECK_OPPO_STATE -->|"True|对手单完成"| DEQUEUE["book.Dequeue(oppoOrder.OrderId)<br/>对手单出队"]

    DEQUEUE --> UPDATE_PRICE1["price = oppoOrder.Price<br/>更新成交价格"]

    UPDATE_PRICE1 --> LOOP1

    CHECK_OPPO_STATE -->|"False|对手单未完成"| CHECK_PARTIAL{"oppoOrder.isPartialFilled()?"}

    CHECK_PARTIAL -->|"True|部分成交"| UPDATE_PRICE2["price = oppoOrder.Price<br/>更新成交价格"]

    UPDATE_PRICE2 --> CHECK_ORDER_STATE{"检查order状态"}

    CHECK_PARTIAL -->|"False|未部分成交"| CHECK_ORDER_STATE

    CHECK_ORDER_STATE -->|"SelfTradePartialCanceled"| RETURN5["finalizeTaker(order.SetState(SelfTradePartialCanceled))<br/>自成交部分取消"]
    RETURN5 --> END

    CHECK_ORDER_STATE -->|"SelfTradeCanceled"| RETURN6["finalizeTaker(order.SetState(SelfTradeCanceled))<br/>自成交取消"]
    RETURN6 --> END

    CHECK_ORDER_STATE -->|"Filled|订单完成"| RETURN7["finalizeTaker(order.SetState(Filled))<br/>订单完成"]
    RETURN7 --> END

    CHECK_ORDER_STATE -->|"其他|继续循环"| LOOP1

    style START fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style END fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style MATCH fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
    style DEQUEUE fill:#9c27b0,color:#fff,stroke:#7b1fa2,stroke-width:3px
~~~



订单流转过程讲解：

1. 进入自循环
2. 判断taker 单是否为已成交，自成交部分，自撤销，如果是停止撮合并将结果finalizeTaker返回到撮合结果results
3. 如果不是，去拿对手单
4. 没有拿到对手单，停止撮合并将结果finalizeTaker返回到撮合结果results
5. 拿到对手单，判断对手单的成交价是否超过了熔断件
6. 超过熔断价，停止撮合并将结果finalizeTaker返回到撮合结果results 并标注撮合订单状态为熔断失败撤销
7. 执行撮合
8. 如果撮合结果不为 nil，将结果 tmpOrderResult 添加到results
9. 如果结果为 nil，判断是否是精度原因，如果是则停止撮合并将结果finalizeTaker(order.SetState(PrecisionCanceled)))返回到撮合结果results
10. 检查对手单状态，是否为完全成交，自成交部分，自成交撤销
11. 如果是下架该对手单，并验证该对手单是否完全成交，如果是怎将对手单的价格作为返回值 返回，继续进行循环
12. 如果是部分成交，则将成交价作为价格返回值返回，同时检查 taker 订单状态
13. 如果 taker 状态为SelfTradePartialCanceled，则append(results, finalizeTaker(order.SetState(SelfTradePartialCanceled)))
14. 如果 taker 状态为SelfTradeCanceled，则append(results, finalizeTaker(order.SetState(SelfTradeCanceled)))
15. 如果 taker 状态为完全成交，则append(results, finalizeTaker(order.SetState(Filled)))，不是完成成交，继续 continue
16. 否则 brake





#### FOK

只能在一笔交易中全部成交，或者全部不成交

~~~mermaid

flowchart TB
    subgraph Title["🔒 FOK单撮合详细流程 matchFok()"]
    end

    START([开始 matchFok]) --> PRECHECK["canFilledFokOrder(order)<br/>预检查是否能全部成交"]

    PRECHECK --> CHECK_PRE{"ok == false?"}

    CHECK_PRE -->|"True|无法全部成交"| RETURN1["finalizeTaker(order)<br/>订单取消"]
    RETURN1 --> END([结束])

    CHECK_PRE -->|"False|可以全部成交"| LOOP1{"循环检查<br/>order.isFilled() ||<br/>order.isSelfTrade()?"}

    LOOP1 -->|"True|已成交或自成交"| RETURN2["finalizeTaker(order)<br/>返回结果"]
    RETURN2 --> END

    LOOP1 -->|"False|继续撮合"| PEEK["oppoOrder := peekOppoOrder(order)<br/>获取最佳对手单"]

    PEEK --> CHECK_OPPO{"oppoOrder == nil"}

    CHECK_OPPO -->|"True|无对手单"| RETURN3["finalizeTaker(order.SetState(Canceled))<br/>订单取消"]
    RETURN3 --> END

    CHECK_OPPO -->|"False|有对手单"| CHECK_CIRCUIT{"len(results) > 0 &&<br/>!order.CircuitRate.Equals(0) &&<br/>价格超出熔断范围?"}

    CHECK_CIRCUIT -->|"True|触发熔断"| RETURN4["finalizeTaker(order.SetState(CircuitCanceled))<br/>熔断取消"]
    RETURN4 --> END

    CHECK_CIRCUIT -->|"False|未触发熔断"| MATCH["tmpOrderResult := matchOrder(book, order, oppoOrder)<br/>执行撮合"]

    MATCH --> CHECK_RESULT{"tmpOrderResult != nil?"}

    CHECK_RESULT -->|"False|精度取消"| RETURN5["finalizeTaker(order.SetState(PrecisionCanceled))<br/>精度取消"]
    RETURN5 --> END

    CHECK_RESULT -->|"True|撮合成功"| APPEND1["results = append(results, tmpOrderResult)<br/>添加成交结果"]

    APPEND1 --> CHECK_OPPO_STATE{"oppoOrder状态检查<br/>isFilled() ||<br/>isSelfTradeCanceled() ||<br/>isSelfTradePartialCanceled()"}

    CHECK_OPPO_STATE -->|"True|对手单完成"| DEQUEUE["book.Dequeue(oppoOrder.OrderId)<br/>对手单出队"]

    DEQUEUE --> CHECK_FILLED{"oppoOrder.isFilled()"}

    CHECK_FILLED -->|"True|完全成交"| UPDATE_PRICE["price = oppoOrder.Price<br/>更新成交价格"]

    UPDATE_PRICE --> LOOP1

    CHECK_FILLED -->|"False|部分成交"| LOOP1

    CHECK_OPPO_STATE -->|"False|对手单未完成"| LOOP1

    style START fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style END fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style PRECHECK fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
    style MATCH fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
~~~

代码运行逻辑：

1. 首先执行预检，
2. 判断taker 单是否可以完全成交，如果可以则继续进行撮合，如果不可以直接 return
3. 开启自循环
4. 判断 taker 订单状态是否为已成交，自撤销，部分自撤销，如果是则append(results, finalizeTaker(order))并 break
5. 取对手单，如果没有对手单append(results, finalizeTaker(order.SetState(Canceled)))
6. 如果有对手单，先执行熔断判断，如果熔断，则append(results, finalizeTaker(order.SetState(CircuitCanceled)))，break
7. 没有熔断，则执行撮合，
8. 撮合结果不等于 nil，成交下单，results = append(results, tmpOrderResult)
9. 撮合结果为 nil，首先判断如果是精度原因则执行append(results, finalizeTaker(order.SetState(PrecisionCanceled)))，break
10. 如果不是，则可能为自成交，continue
11. 判读对手单是否完全成交或者自撤销或者部分自撤销，如果是下架该对手单，如果是完全成交则将对手单价格赋值给返回的价格，continue
12. 如果对手单是部分自成交，则将价格赋值给返回的价格
13. 检查 taker 订单的状态
14. 如果是SelfTradePartialCanceled，则append(results, finalizeTaker(order.SetState(SelfTradePartialCanceled)))，break
15. 如果是SelfTradeCanceled，则append(results, finalizeTaker(order.SetState(SelfTradeCanceled)))，break
16. 否则则判断 taker 是否Filled，则 append(results, finalizeTaker(order.SetState(Filled)))，break
17. 如果不是Filled 则continue

#### IOC

立刻成交，能成交多少，就成交多少，剩下没有成交成功的原路返回

#### Cancel

撤销订单，如果订单还在订单簿上只能撤销剩余量，如果不在订单簿上不能撤销

执行流程：

1. 取对应的订单
2. 如果可以取到订单，则撤销剩余量，并修改订单状态
3. 如果取不到订单，返回订单状态，撤单失败

#### SystemCancel

系统撤单，场景比如订单有效期到了，系统会定时将过期订单撤销

~~~mermaid

flowchart TB
    subgraph Title["⚙️ 系统取消详细流程 matchSystemCancel()"]
    end

    START([开始 matchSystemCancel]) --> FIND["order := FindOrder(orderId)<br/>查找待取消订单"]

    FIND --> CHECK_EXISTS{"order != nil"}

    CHECK_EXISTS -->|"True|订单存在"| SET_STATE["order.State = SystemCanceled<br/>设置系统取消状态"]

    SET_STATE --> GET_AMOUNT["unfilledAmount := order.UnfilledAmount<br/>获取未成交金额"]

    GET_AMOUNT --> CALCULATE["计算已成交金额<br/>amount - unfilledAmount"]

    CALCULATE --> REMOVE["RemoveOrder(order)<br/>从订单簿移除"]

    REMOVE --> RETURN_RESULT["返回系统取消结果<br/>包含订单信息、状态、未成交金额"]
    RETURN_RESULT --> END([结束])

    CHECK_EXISTS -->|"False|订单不存在"| RETURN_NOT_FOUND["订单不存在<br/>记录日志"]
    RETURN_NOT_FOUND --> END

    style START fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style END fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style SET_STATE fill:#ff9800,color:#fff,stroke:#f57c00,stroke-width:3px
    style REMOVE fill:#f44336,color:#fff,stroke:#d32f2f,stroke-width:3px
~~~



执行流程：

1. 定期检查过期的订单
2. 每查到一个过期订单就撤销一个过期订单

#### BatchCancel

批量撤销订单

~~~
/*
* @notion 批量撤销订单
* @param 订单结构体
* @return price 撤单价格
* @return results 撤单的价格指针
*/
func (book *OrderBook) matchBatchCancel(order *Order) (price decimal.Decimal, results []*OrderResult) 
~~~

执行流程：

1. 将需要批量撤销的订单放入BatchCancelOrder 列表
2. 反序列化
3. 循环订单列表，如果该订单存在则下架该订单，并根据剩余量标记撤销状态
4. 如果该订单不存在，则直接返回完全成交



#### 自成交策略

- AST：按照正常策略正常执行
- DC：减量自成交，比如卖 3eth，买 2eth，按照 DC 策略，执行后变为卖 1eth
- CO：删除旧单，新下单为买 2eth，旧单为卖 3eth，按照 CO 策略，执行后变为买 2eth
- CN：删除新单，新下单为买 2eth，旧单为卖 3eth，按照 CN 策略，执行后变为卖 3eth
- CB：删除旧单，新下单为买 2eth，旧单为卖 3eth，按照 CB 策略，执行后变为卖单和买单都是 0eth

代码执行流程：

1. 如果订单没有指定自成交的逻辑，则执行 AST 策略
2. 如果订单标注了CO，则变更 maker 的订单状态
3. 如果订单标注了 CN，则变更 taker 的订单状态
4. 如果订单标注了 CB，则变更双方的订单状态
5. 如果订单标注了 DC，按照以下策略执行
   1. 计算 taker 的orderAmount，和oppoOrder.UnfilledAmount 取最小值matchAmount
   2. 计算最小值需要的资金量matchCashAmount
   3. 安全判断：matchCashAmount 是否大于order.UnfilledAmount或者matchAmount 是否大于oppoOrder.UnfilledAmount 如果是报错Fatal。这种情况在计算失误的情况会产生
   4. 如果taker 和 maker 的数量是 Amount 一致，则判断 taker 的CashAmount 是否有剩余，如果有剩余则将剩余的CashAmount 挂一个新单，原来的taker 和 maker 都变更状态
   5. 如果 taker 的Amount 大于oppoOrder的UnfilledAmount，则更新order.UnfilledAmount，变更对手单状态，变更量为order.UnfilledAmount=Amount-oppoOrder.UnfilledAmount
   6. 如果 taker的Amount 小于oppoOrder的UnfilledAmount，则变更oppoOrder.UnfilledAmount和状态，变更量为order.UnfilledAmount=Amount-oppoOrder.UnfilledAmount



### 订单匹配规则

价格优先，时间优先。

先看有没有最优价，再从最优价里面选时间在前面的先成交。

如果taker 是买单，则 taker 出的价钱要大于等于 maker 的价钱

如果 taker 是卖单，则 taker 出的价钱要小于等于 maker 的价钱

最后的成家价是由买卖双方的最低价决定的，最后的成交量是由 双方可成交剩余量决定

#### 基于订单量匹配（基础币 eth）

代码运行逻辑

1. 获取 taker 和 maker 中最小的UnfilledAmount 为matchAmount
2. 判断是否为自成交且 STP>0
3. 如果为真则根据自成交的逻辑执行交易
4. 如果为假则按照正常的交易执行，扣减 taker 和 maker 中的matchAmount
5. 返回匹配好的值

#### 基于金额匹配（成交币 usdc 或其他）

适用场景只有市价单中买单，即用 usdc 购买 eth，代码运行逻辑为

1. 获取档位中最小的档位
2. 判断购买价格是否比最小档位的价格还要小，如果是 return
3. 判断是否为自成交且 STP>0，如果是则执行自成交逻辑
4. 根据 taker 的资金计算对应 order.amount，从 taker 和 maker 的 amount 中选出最小的
5. 根据最小的amount 算出 taker 购买需要花费的资金matchCashAmount
6. 判断计算出来的amount大于 maker.amount或者matchCashAmount 大于order.UnfilledAmount 则 fatal
7. 扣减 taker 和 maker 中的matchAmount，返回匹配好的值

## 快照流程

### 快照流程图

~~~mermaid

flowchart TB
    subgraph Title["📸 快照保存流程图"]
    end

    subgraph Config["⚙️ 配置参数"]
        C1["scheduler.snapshot: [0, 60000]\n偏移: 0ms\n间隔: 60000ms (60秒)"]
        C2["app.seq: 0\n序列偏移"]
        C3["snapshot.keep-num: 10\n保留最近10个快照"]
    end

    subgraph Init["🚀 定时器初始化"]
        I1["scheduler.NewTickerSnapshot()\n创建快照定时器"]
        I2["baseMs = 0ms\nintervalMs = 60000ms\nseqOffset = 60秒 × seq"]
        I3["返回 Ticker 对象\n下一次触发时间 = now + baseMs + seqOffset"]
        I4["启动 goroutine\n监听 snapshotTicker.C 通道"]
    end

    subgraph Timer["⏰ 定时器触发"]
        T1{"snapshotTicker.C\n收到信号"}
        T2["当前时间 >= 触发时间?"]
        T3["克隆订单簿\nbook.Clone()"]
        T4["发送到快照通道\nsnapshotChan <- cloneBook"]
    end

    subgraph Save["💾 快照保存"]
        S1["接收 cloneBook\n<-snapshotChan"]
        S2["序列化订单簿\nGobEncode(cloneBook)"]
        S3["生成文件名\n{symbol}.snapshot.{lastId}"]
        S4{"配置是否启用S3?"}
        S5["保存到本地文件\n./sp/{symbol}.snapshot.{lastId}"]
        S6["上传到S3\n备份到云存储"]
    end

    subgraph Cleanup["🧹 清理旧快照"]
        CL1["检查快照数量\n是否 > keep-num"]
        CL2["删除最早的快照文件"]
        CL3["更新快照元数据\nlastId, timestamp"]
    end

    subgraph Error["❌ 错误处理"]
        E1{"序列化失败?"}
        E2{"写入文件失败?"}
        E3{"上传S3失败?"}
        E4["记录错误日志\n但不终止程序"]
        E5["返回错误\n继续下次定时"]
    end

    subgraph Recovery["🔄 恢复流程"]
        R1["startExchange()\n启动撮合引擎"]
        R2["snapshotter.GetLastSnapshotId(symbol)\n获取最后快照ID"]
        R3{"lastId > 0?"}
        R4["加载最新快照\nsnapshotter.Load(symbol, ctype, lastId)"]
        R5["初始化空订单簿\nmatch.InitOrderBook(0, symbol)"]
        R6["从 lastId+1 开始拉取订单\npuller.Init(ch, symbol, lastId+1)"]
    end

    Config --> Init
    Init --> Timer

    I1 --> I2 --> I3 --> I4

    T1 --> T2
    T2 -->|"Yes"| T3 --> T4
    T2 -->|"No|未到时间"| T1
    T4 --> Save

    Save --> S1 --> S2 --> S3 --> S4
    S4 -->|"No"| S5
    S4 -->|"Yes"| S6
    S5 & S6 --> Cleanup

    S2 --> E1
    S5 --> E2
    S6 --> E3
    E1 & E2 & E3 --> E4 --> E5

    Cleanup --> R1

    R1 --> R2 --> R3
    R3 -->|"Yes"| R4
    R3 -->|"No|首次启动"| R5
    R4 & R5 --> R6

    style Title fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style Init fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Save fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style Cleanup fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style Recovery fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style Error fill:#ffebee,stroke:#d32f2f,stroke-width:2px
~~~

## K 线

### K 线流程图

~~~mermaid

flowchart TB
    subgraph Title["🕯️ K线生成流程图"]
    end

    subgraph Config["⚙️ 配置参数"]
        C1["K线周期：9种\n1min, 5min, 15min, 30min\n60min, 4hour, 1day, 1week, 1month"]
        C2["定时器配置：\n每100ms检查是否需要推送"]
        C3["缓存策略：\n在内存中缓冲，更新时合并"]
    end

    subgraph Input["📥 成交结果输入"]
        I1["成交结果\nMatchResult"]
        I2["包含字段：\nId, Price, Amount, Ts, Symbol"]
        I3["发送到 mrChan\nmrChan <- bytesJson"]
    end

    subgraph Process["⚙️ 并行计算单元"]
        subgraph K1["1分钟K线"]
            K1_1["计算K线ID\nTs / 60000 × 60000"]
            K1_2["更新OHLC\nopen/close/high/low"]
            K1_3["累加成交量\nvol += amount"]
            K1_4["更新时间戳"]
        end

        subgraph K5["5分钟K线"]
            K5_1["计算K线ID\nTs / 300000 × 300000"]
            K5_2["更新OHLC"]
            K5_3["累加成交量"]
            K5_4["更新时间戳"]
        end

        subgraph K15["15分钟K线"]
            K15_1["计算K线ID\nTs / 900000 × 900000"]
            K15_2["更新OHLC"]
            K15_3["累加成交量"]
            K15_4["更新时间戳"]
        end

        subgraph K30["30分钟K线"]
            K30_1["计算K线ID\nTs / 1800000 × 1800000"]
            K30_2["更新OHLC"]
            K30_3["累加成交量"]
            K30_4["更新时间戳"]
        end

        subgraph K60["1小时K线"]
            K60_1["计算K线ID\nTs / 3600000 × 3600000"]
            K60_2["更新OHLC"]
            K60_3["累加成交量"]
            K60_4["更新时间戳"]
        end

        subgraph K4H["4小时K线"]
            K4H_1["计算K线ID\nTs / 14400000 × 14400000"]
            K4H_2["更新OHLC"]
            K4H_3["累加成交量"]
            K4H_4["更新时间戳"]
        end

        subgraph K1D["1天K线"]
            K1D_1["计算K线ID\nTs / 86400000 × 86400000"]
            K1D_2["更新OHLC"]
            K1D_3["累加成交量"]
            K1D_4["更新时间戳"]
        end

        subgraph K1W["1周K线"]
            K1W_1["计算K线ID\nTs / 604800000 × 604800000"]
            K1W_2["更新OHLC"]
            K1W_3["累加成交量"]
            K1W_4["更新时间戳"]
        end

        subgraph K1M["1月K线"]
            K1M_1["计算K线ID\n(年/月) × 月开始时间戳"]
            K1M_2["更新OHLC"]
            K1M_3["累加成交量"]
            K1M_4["更新时间戳"]
        end
    end

    subgraph Timer["⏰ 定时推送机制"]
        T1["定时器触发\n每100ms"]
        T2["检查是否有K线更新"]
        T3{"更新数量 > 0?"}
        T4["批量打包K线数据"]
        T5["发送到MQ"]
        T6["更新Redis缓存"]
    end

    subgraph Output["📤 输出"]
        O1["RabbitMQ\n行情队列"]
        O2["Redis\n缓存"]
        O3["推送格式：\nJSON数组包含所有周期的K线"]
    end

    Input --> Process
    I1 -.->|"并行计算"| K1
    I1 -.->|"并行计算"| K5
    I1 -.->|"并行计算"| K15
    I1 -.->|"并行计算"| K30
    I1 -.->|"并行计算"| K60
    I1 -.->|"并行计算"| K4H
    I1 -.->|"并行计算"| K1D
    I1 -.->|"并行计算"| K1W
    I1 -.->|"并行计算"| K1M

    Timer --> T1 --> T2 --> T3
    T3 -->|"Yes"| T4 --> T5
    T3 -->|"No|无更新"| T1
    T5 --> Output
    T4 --> T6 --> Output

    style Title fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style Input fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Process fill:#fff8e1,stroke:#f9a825,stroke-width:2px
    style Timer fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style Output fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
~~~



## 市场深度

### 市场深度更新流程图

~~~mermaid
flowchart TB
    subgraph Title["📊 市场深度更新流程图"]
    end

    subgraph Config["⚙️ 配置参数"]
        C1["min-depth-update-interval-ms: 100<br/>深度更新间隔: 100ms"]
        C2["min-stacked-depth-update-interval-ms: 1000<br/>堆叠深度间隔: 1秒"]
        C3["default-update-interval-ms: 1000<br/>默认更新间隔: 1秒"]
        C4["depth.steps: [0.0001, 0.001, 0.01]<br/>深度档位"]
    end

    subgraph Input["📥 输入"]
        I1["成交事件触发<br/>matcher中撮合成功"]
        I2["workMark = true<br/>标记有更新"]
        I3["发送到 depthChan"]
    end

    subgraph Timer1["⏰ 深度定时器1（100ms）"]
        T1_1{"minDepthTicker.C<br/>每100ms触发"}
        T1_2{"workMark == true?"}
        T1_3["market.BuildAndReportDepth(book)<br/>构建深度数据"]
        T1_4["发送到 depthChan"]
        T1_5["workMark = false<br/>重置标记"]
    end

    subgraph Timer2["⏰ 深度定时器2（1秒）"]
        T2_1{"stackedTicker.C<br/>每1秒触发"}
        T2_2["market.BuildAndReportDepthPercent10(book)<br/>构建10%档位深度"]
        T2_3["发送到 depthChan"]
    end

    subgraph DepthCalc["📊 深度计算"]
        D1["从订单簿提取数据"]
        D2["买单集合 (Buy Set)<br/>价格降序"]
        D3["卖单集合 (Sell Set)<br/>价格升序"]
        D4["按档位分组<br/>DepthSteps"]
        D5["计算深度数据<br/>[bids, asks]"]
    end

    subgraph Batch["📦 批量打包"]
        B1["接收 depth 数据"]
        B2["批量收集<br/>最多90条"]
        B3["打包成 JSON 数组<br/>[depth1, depth2, ...]"]
        B4["发送到发布队列"]
    end

    subgraph Output["📤 输出"]
        O1["RabbitMQ<br/>发布到 exchange"]
        O2["前端订阅<br/>WebSocket/HTTP"]
        O3["深度格式示例<br/>{type:depth,bids:[[price,amount]],asks:[[price,amount]]}"]
    end

    Input --> I1 --> I2 --> I3
    I3 --> Timer1

    T1_1 --> T1_2
    T1_2 -->|"Yes|有更新"| T1_3 --> T1_4 --> T1_5
    T1_2 -->|"No|无更新"| T1_1
    T1_4 --> Batch

    T2_1 --> T2_2 --> T2_3 --> Batch

    I3 --> DepthCalc
    DepthCalc --> D1 --> D2 & D3
    D2 --> D4
    D3 --> D4
    D4 --> D5 --> Batch

    Batch --> O1 --> O2
    Batch --> O3

    style Title fill:#4caf50,color:#fff,stroke:#388e3c,stroke-width:4px
    style Config fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Timer1 fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style Timer2 fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style DepthCalc fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style Batch fill:#fff8e1,stroke:#f9a825,stroke-width:2px
~~~









## 缺失数据解决方案流程图

~~~mermaid
flowchart TB
    subgraph Title["❌ 数据缺失场景及解决方案"]
    end

    subgraph Problem1["📸 问题1：快照缺失"]
        P1_1["场景：首次启动新币对"]
        P1_2["影响：校验器 Fatal，程序崩溃"]
        P1_3{"解决方案"}
        P1_4["方案A：首次启动自动创建空快照<br/>match.InitOrderBook(0, symbol)<br/>snapshotter.DumpSnapshot()"]
        P1_5["方案B：首次部署禁用校验<br/>validate.enabled = false"]
        P1_6["方案C：手动创建初始快照<br/>API: POST /snapshot/create"]
    end

    subgraph Problem2["🕯️ 问题2：K线数据缺失"]
        P2_1["场景：Redis缓存丢失或首次启动"]
        P2_2["影响：K线图表显示空白"]
        P2_3{"解决方案"}
        P2_4["方案A：从数据库重建K线<br/>SELECT成交记录<br/>按时间聚合计算OHLC"]
        P2_5["方案B：从历史快照恢复<br/>加载最近快照<br/>重新处理lastId之后的订单"]
        P2_6["方案C：定时快照K线状态<br/>与订单簿快照一起保存<br/>l2quote/snapshot.go"]
    end

    subgraph Problem3["📊 问题3：深度数据缺失"]
        P3_1["场景：订单簿为空或初始化中"]
        P3_2["影响：盘口显示空白"]
        P3_3{"解决方案"}
        P3_4["方案A：返回空深度<br/>{bids:[],asks:[]}<br/>前端显示空盘口"]
        P3_5["方案B：从快照恢复<br/>加载订单簿状态<br/>立即可用"]
        P3_6["方案C：缓存最近深度<br/>Redis存储<br/>重启后快速恢复"]
    end

    subgraph Problem4["💾 问题4：成交记录缺失"]
        P4_1["场景：Persistence批量插入失败"]
        P4_2["影响：成交记录不完整"]
        P4_3{"解决方案"}
        P4_4["方案A：重试机制<br/>失败后重试3次<br/>间隔递增"]
        P4_5["方案B：消息队列缓冲<br/>RabbitMQ持久化<br/>确保不丢失"]
        P4_6["方案C：定期校验<br/>从订单簿重新计算<br/>补全缺失记录"]
    end

    subgraph Monitor["📊 监控与告警"]
        M1["定时检查数据完整性"]
        M2["Redis监控<br/>连接状态、数据量"]
        M3["数据库监控<br/>主从同步、延迟"]
        M4["快照一致性检查<br/>订单簿 vs 成交记录"]
        M5["告警通知<br/>钉钉/企微/邮件"]
    end

    subgraph Recovery["🔄 自动恢复流程"]
        R1["检测数据异常"]
        R2{"异常类型"}
        R3["快照缺失<br/>→ 自动创建"]
        R4["K线缺失<br/>→ 从DB重建"]
        R5["深度缺失<br/>→ 返回空或恢复"]
        R6["记录日志<br/>通知管理员"]
    end

    P1_1 --> P1_2 --> P1_3
    P1_3 --> P1_4
    P1_3 --> P1_5
    P1_3 --> P1_6

    P2_1 --> P2_2 --> P2_3
    P2_3 --> P2_4
    P2_3 --> P2_5
    P2_3 --> P2_6

    P3_1 --> P3_2 --> P3_3
    P3_3 --> P3_4
    P3_3 --> P3_5
    P3_3 --> P3_6

    P4_1 --> P4_2 --> P4_3
    P4_3 --> P4_4
    P4_3 --> P4_5
    P4_3 --> P4_6

    Monitor --> R1 --> R2
    R2 --> R3
    R2 --> R4
    R2 --> R5
    R3 & R4 & R5 --> R6

    style Title fill:#f44336,color:#fff,stroke:#d32f2f,stroke-width:4px
    style Problem1 fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    style Problem2 fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style Problem3 fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Problem4 fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style Monitor fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style Recovery fill:#fff8e1,stroke:#f9a825,stroke-width:2px
~~~



## 代码接口

### 订单簿

~~~
type OrderBook struct {
 Symbol string
 FromId int64
 cache map[int64]*Order
 BuySet *TreeSet
 SellSet *TreeSet
}
func (book *OrderBook) Cache() map[int64]*Order
func (book *OrderBook) CheckOrderBookAndClear()
func (book *OrderBook) Clone() (newBook *OrderBook)
func (book *OrderBook) Dequeue(orderId int64)
func (book *OrderBook) Enqueue(order *Order)
func (book *OrderBook) Find(orderId int64) *Order
func (book *OrderBook) GenMatchResult(order *Order) *MatchResultWithAskBid
func (book *OrderBook) Match(order *Order) (price decimal.Decimal, results []*OrderResult)
func (book *OrderBook) Peek(buyOrSell OrderBuyOrSell) *Order
func (book *OrderBook) Report()
func (book *OrderBook) SetCache(order *Order)
func (book *OrderBook) String() string
func (book *OrderBook) Take(buyOrSell OrderBuyOrSell, size int64) (values []*Order)
func (book *OrderBook) asksLessPrice(price decimal.Decimal) (values []*Order)
func (book *OrderBook) bidsGreater(price decimal.Decimal) (values []*Order)
func (book *OrderBook) canFilledFokOrder(fokOrder *Order) (bool, OrderState)
func (book *OrderBook) matchBatchCancel(order *Order) (price decimal.Decimal, results []*OrderResult)
func (book *OrderBook) matchCancel(order *Order) (price decimal.Decimal, results []*OrderResult)
func (book *OrderBook) matchFok(order *Order) (price decimal.Decimal, results []*OrderResult)
func (book *OrderBook) matchIoc(order *Order) (results []*OrderResult)
func (book *OrderBook) matchLimit(order *Order) (price decimal.Decimal, results []*OrderResult)
func (book *OrderBook) matchLimitMaker(order *Order) (results []*OrderResult)
func (book *OrderBook) matchMarket(order *Order) (price decimal.Decimal, results []*OrderResult)
func (book *OrderBook) matchSystemCancel(order *Order) (price decimal.Decimal, results []*OrderResult)
func (book *OrderBook) orderSet(buyOrSell OrderBuyOrSell) (orderSet *TreeSet)
func (book *OrderBook) peekOppoOrder(order *Order) *Order
func (book *OrderBook) removeFromOrderSet(order *Order) bool

match.OrderBook on pkg.go.dev
~~~



### persistence

~~~
type Persisten struct {
 DB *sql.DB
 selectPrepare string
 selectStmt *sql.Stmt
 symbol string
 mrChan chan []byte
 mrBatchChan chan [][]byte
}

func (p *Persisten) GaugePersistChan()
func (p *Persisten) GetMatchResult(fromId int64, toId int64) map[int64]string
func (p *Persisten) createSql(datas [][]byte) *string
func (p *Persisten) goBatch()
func (p *Persisten) goPersistence()
func (p *Persisten) initPersistenceInfo()
func (p *Persisten) insertData(datas [][]byte)

persistence.Persisten on pkg.go.dev
~~~

### DB

~~~
type DbInfo struct {
 DataSourceName string
 symbol string
 Prepare string
 DB *sql.DB
 dbStmt *sql.Stmt
 pullerInterval time.Duration
 ch chan *match.Order
}
func (d *DbInfo) GoPuller(ch chan *match.Order, fromId int64)
func (d *DbInfo) InitSymbolConf()
func (d *DbInfo) getOrdersFromDb(fromId int64) (orders []*match.Order)
func (d *DbInfo) initDbInfo(symbol string)
func (d *DbInfo) pullOrder(fromId int64) (orders []*match.Order)

puller.DbInfo on pkg.go.dev
~~~

### rabbitmq

~~~
type RabbitMq struct {
 Id int
 Uris []string
 Connection *amqp.Connection
 amqpChannel *amqp.Channel
 publishChan chan *PublishContent
}
func (rabbitMq *RabbitMq) ChooseUri() string
func (rabbitMq *RabbitMq) Init(id int, uris []string)
func (rabbitMq *RabbitMq) Publish(publishContent *PublishContent)
func (rabbitMq *RabbitMq) connect() error
func (rabbitMq *RabbitMq) reconnect()

rabbitmq.RabbitMq on pkg.go.dev
~~~

### l2Quote

~~~
type L2quote struct {
 symbol string // 交易对名称, 初始化时传入
 redisClient *redis.Client // redisClient连接实例，初始化时传入
 mrChan chan []byte // 传入match result的channel， 初始化时传入
 snapshotPath string // 镜像路径， 初始化时传入
 mqExchangeName string // rabbitMQ的exchange名称， 初始化时传入
 mqSendIntervalMS int64 // 向MQ中发送kline与market.detail的时间间隔， 初始化时传入
 klineForwardLimit int64 // kline向前重绘补全的限制值， 初始化时传入
 mqBatchSize int // mq发送打包大小， 初始化时传入
 snapshotMaxHistoryNum int64 // 快照保留的数量, 初始化时传入
 makeNewKlineAtSec int // 每分钟第几秒钟检测是否需要新建空kline, 初始化时传入

 redisCache []map[int64]int // redis update的缓存
 quotation *Quotation // 内存行情结构体
 marketDetail *kline // 24小时汇总
 ticker *Ticker //ticker message
 mqSendChan chan *MqMessage // mq汇总发送队列
 sendMRID int64 // 行情发送点标记
 sendMarketMRID int64 // market detail发送点标记
 lastSnapshotTime int // 最后一次快照时间
 ctx context.Context
}
func (L *L2quote) Init() int64
func (L *L2quote) Run()
func (L *L2quote) UploadToS3(pathName string)
func (L *L2quote) buildL2quoteSnapshotPath(id int64) string
func (L *L2quote) buildMarket(ts int64)
func (L *L2quote) buildMarket24Hour(ts int64)
func (L *L2quote) buildMarketCurDay(ts int64)
func (L *L2quote) buildMarketPriceCurDayVol24Hour(ts int64)
func (L *L2quote) checkRedisKline()
func (L *L2quote) checkSnapShot()
func (L *L2quote) genSnapshotPath() string
func (L *L2quote) genSnapshotPathTmp() string
func (L *L2quote) getAllCurrentKline(ts int64)
func (L *L2quote) getCurrentKline(klineType string, ts int64)
func (L *L2quote) getLastSnapshot() (q Quotation, err error)
func (L *L2quote) getMaxMRIDFromRedis() (int64, error)
func (L *L2quote) initKlineFromSnapshots()
func (L *L2quote) klineToRedisFormat(k *kline, klineType string) (string, int64, string)
func (L *L2quote) klineUpdater(mrCh chan *match.MatchResult, klineType string, wg *sync.WaitGroup)
func (L *L2quote) market(mrCh chan *match.MatchResult, wg *sync.WaitGroup)
func (L *L2quote) recoverFromSnapshot() error
func (L *L2quote) reportKlines(ts int64)
func (L *L2quote) saveKlinesToRedis() error
func (L *L2quote) sendAllKlines(ts int64)
func (L *L2quote) sendMarketDetail(ts int64)
func (L *L2quote) sendToMQ(mqCh chan *MqMessage)
func (L *L2quote) sendTradeDetail(mr *match.MatchResult)
func (L *L2quote) syncTickerMessage()
func (L *L2quote) takeSnapShot()
func (L *L2quote) trade(mrCh chan *match.MatchResult, wg *sync.WaitGroup)
func (L *L2quote) updateKline(mr *match.MatchResult, ts int64, klineType string)
func (L *L2quote) updateMarketDetail(mr *match.MatchResult, ts int64)
func (L *L2quote) updateMarketDetail24Hour(mr *match.MatchResult, ts int64)
func (L *L2quote) updateMarketDetailCurDay(mr *match.MatchResult, ts int64)
func (L *L2quote) updateMarketDetailPriceCurDayVol24Hour(mr *match.MatchResult, ts int64)

l2quote.L2quote on pkg.go.dev
~~~






