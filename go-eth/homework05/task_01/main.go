package main

import (
	"context"
	"crypto/ecdsa"
	"flag"
	"fmt"
	"log"
	"math/big"
	"os"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// 支持三种交易模式
// 1.查询交易：--tx <hash>  -按哈希查询交易与回执，解析关键字段
// 2.查询区块：--block <int>  -按区块号查询交易信息，解析关键字段
// 3.发送交易：--send --to <address> --amount <eth> -发起 ETH 转帐交易

func main() {
	txHashHex := flag.String("tx", "", "transaction hash (for query mode)")
	blockNumber := flag.Int64("block", -1, "block number (required for send mode)")
	sendMode := flag.Bool("send", false, "enable send transaction mode")
	toAddrHex := flag.String("to", "", "recipient address (required for send mode)")
	amountEth := flag.Float64("amount", 0, "amount in ETH (required for send mode)")
	flag.Parse()

	// 发送模式
	if *sendMode {

		if *toAddrHex == "" || *amountEth <= 0 {
			log.Fatal("send mode requires --to and --amount flags")
		}
		sendTransaction(*toAddrHex, *amountEth)
	} else {
		// 查询交易模式
		if *txHashHex != "" {
			queryTransaction(*txHashHex)
		} else if *blockNumber >= 0 {
			queryBlock(*blockNumber)
		} else {
			log.Fatal("query mode requires --tx flag, or use --block flag for query mode")
		}
	}

	// 查询区块模式
	if *blockNumber < 0 {
		queryBlock(*blockNumber)
	}
}

// 查询区块
func queryBlock(blockNumber int64) {
	rpcURL := os.Getenv("ETH_RPC_URL")
	if rpcURL == "" {
		log.Fatal("ETH_RPC_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		log.Fatalf("failed to connect to Ethereum node :%v", err)
	}
	defer client.Close()

	if blockNumber < 0 {
		block, err := client.BlockByNumber(ctx, nil)
		if err != nil {
			log.Printf("failed to get block: %v", err)
		}
		printBlockInfo(block)
	} else {
		queryBlockNumber := big.NewInt(blockNumber)

		block, err := client.BlockByNumber(ctx, queryBlockNumber)
		if err != nil {
			log.Printf("failed to get block: %v", err)
		}
		printBlockInfo(block)

	}

}

// 查询交易
func queryTransaction(txHashHex string) {
	rpcURL := os.Getenv("ETH_RPC_URL")
	if rpcURL == "" {
		log.Fatal("ETH_RPC_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		log.Fatalf("failed to connect to Ethereum node :%v", err)
	}
	defer client.Close()

	txHash := common.HexToHash(txHashHex)

	tx, isPending, err := client.TransactionByHash(ctx, txHash)
	if err != nil {
		log.Printf("failed to get receipt (maybe pending): %v", err)
	}

	fmt.Println("=== Transaction ===")
	printTxBasicInfo(tx, isPending)

	receipt, err := client.TransactionReceipt(ctx, txHash)
	if err != nil {
		log.Printf("failed to get receipt (maybe pending): %v", err)
		return
	}
	fmt.Println("=== Receipt ===")
	printReceiptInfo(receipt)

}

// 发送交易
func sendTransaction(toAddrHex string, amountEth float64) {
	// 0.准备基础数据
	privateKeyHex := os.Getenv("PRIVET_KEY")
	// toAddrHex := os.Getenv("TO_ADDR")
	// sendEthAmount := 0.001
	sendEthAmount := amountEth

	// 1.链接测试网
	rpcURL := os.Getenv("ETH_RPC_URL")
	if rpcURL == "" {
		log.Fatal("ETH_RPC_URL is not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		log.Fatalf("connect test network file:%v", err)
	}
	defer client.Close()

	// 2.解析私钥
	privateKey, err := crypto.HexToECDSA(trim0x(privateKeyHex))
	if err != nil {
		log.Fatalf("publicKey parse file:%v", err)
	}
	// 3.获取公钥
	publicKey := privateKey.Public().(*ecdsa.PublicKey)
	fromAddr := crypto.PubkeyToAddress(*publicKey)
	fmt.Println("from address :", fromAddr.Hex())
	toAddr := common.HexToAddress(toAddrHex)

	// 4.获取链ID
	chainID, err := client.ChainID(ctx)
	if err != nil {
		log.Fatalf("get chainID file:%v", err)
	}

	// 5.获取账户交易序号nonce（防止双花）
	nonce, err := client.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		log.Fatalf("get nonce file:%v", err)
	}

	// 6.转账金额转换：ETH->wei（1 ETH =10^18wei）
	weiAmount := new(big.Float).Mul(big.NewFloat(sendEthAmount), big.NewFloat(1e18))
	valueWei, _ := weiAmount.Int(nil)

	// 7.设置交易费用
	// 获取Gas价格（使用EIP-1559动态费用）
	gasTipCap, err := client.SuggestGasTipCap(ctx)
	if err != nil {
		log.Fatalf("failed to get gas tip cap :%v", err)
	}
	// 获取base fee 计算fee cap
	header, err := client.HeaderByNumber(ctx, nil)
	if err != nil {
		log.Fatalf("failed to get header : %v", err)
	}
	baseFee := header.BaseFee
	if baseFee == nil {
		// 如果不支持 EIP-1559，使用传统 gas price
		gasPrice, err := client.SuggestGasPrice(ctx)
		if err != nil {
			log.Fatalf("failed to get gas price: %v", err)
		}
		baseFee = gasPrice
	}

	// fee cap = base fee * 2 + tip cap（简单策略）
	gasFeeCap := new(big.Int).Add(
		new(big.Int).Mul(baseFee, big.NewInt(2)),
		gasTipCap,
	)

	// 估算 Gas Limit（普通转账固定为 21000）
	gasLimit := uint64(21000)
	// 计算总费用：value + gasFeeCap * gasLimit
	totalCost := new(big.Int).Add(
		valueWei,
		new(big.Int).Mul(gasFeeCap, big.NewInt(int64(gasLimit))),
	)

	// 检查余额是否足够
	balance, err := client.BalanceAt(ctx, fromAddr, nil)
	if err != nil {
		log.Fatalf("failed to get balance: %v", err)
	}

	if balance.Cmp(totalCost) < 0 {
		log.Fatalf("insufficient balance: have %s wei, need %s wei", balance.String(), totalCost.String())
	}

	// 8.构造交易数据
	txDate := &types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonce,
		GasTipCap: gasTipCap,
		GasFeeCap: gasFeeCap,
		Gas:       gasLimit,
		To:        &toAddr,
		Value:     valueWei,
		Data:      nil,
	}
	tx := types.NewTx(txDate)
	// 9.签名交易
	signer := types.NewLondonSigner(chainID)
	signedTx, err := types.SignTx(tx, signer, privateKey)
	if err != nil {
		log.Fatalf("failed to sign transaction: %v", err)
	}
	// 10.发送交易
	if err := client.SendTransaction(ctx, signedTx); err != nil {
		log.Fatalf("failed to send transaction: %v", err)
	}
	// 11.输出结果
	fmt.Println("=== Transaction Sent ===")
	fmt.Printf("From		: %s\n", fromAddr.Hex())
	fmt.Printf("To		: %s\n", toAddr.Hex())
	fmt.Printf("Value		: %s ETH (%s Wei)\n", fmt.Sprintf("%.6f", sendEthAmount), valueWei.String())
	fmt.Printf("Gas Limit	: %d\n", gasLimit)
	fmt.Printf("Gas Tip Cap	: %s Wei\n", gasTipCap.String())
	fmt.Printf("Gas Fee Cap	: %s Wei\n", gasFeeCap.String())
	fmt.Printf("Nonce      	: %d\n", nonce)
	fmt.Printf("Tx Hash    	: %s\n", signedTx.Hash().Hex())

}

func printBlockInfo(block *types.Block) {
	fmt.Println("======= 🟢 Sepolia 区块信息 =======")
	fmt.Println("区块哈希:", block.Hash().Hex())
	fmt.Println("父区块哈希:", block.ParentHash().Hex())
	fmt.Println("区块高度:", block.Number().Uint64())
	fmt.Println("时间戳:", block.Time())
	fmt.Println("格式化时间:", time.Unix(int64(block.Time()), 0).Format("2006-01-02 15:04:05"))
	fmt.Println("Gas 限额:", block.GasLimit())
	fmt.Println("Gas 已使用:", block.GasUsed())
	fmt.Println("矿工地址:", block.Coinbase().Hex())
	fmt.Println("交易数量:", len(block.Transactions()))
	fmt.Println("难度值:", block.Difficulty().Uint64())
	fmt.Println("====================================")

	fmt.Println("=======  output all transaction list  ======= ")
	fmt.Printf("transcation list len : %d \n", len(block.Transactions()))
	for i, tx := range block.Transactions() {
		fmt.Printf("transcationId %d : %s \n", i+1, tx.Hash().Hex())
	}
}

// 打印交易信息
func printTxBasicInfo(tx *types.Transaction, isPending bool) {
	fmt.Printf("Hash        : %s\n", tx.Hash().Hex())
	fmt.Printf("Nonce       : %d\n", tx.Nonce())
	fmt.Printf("Gas         : %d\n", tx.Gas())
	fmt.Printf("Gas Price   : %s\n", tx.GasPrice().String())
	fmt.Printf("To          : %v\n", tx.To())
	fmt.Printf("Value (Wei) : %s\n", tx.Value().String())
	fmt.Printf("Data Len    : %d bytes\n", len(tx.Data()))
	fmt.Printf("Pending     : %v\n", isPending)
}

// 打印区块信息
func printReceiptInfo(r *types.Receipt) {
	fmt.Printf("Status      : %d\n", r.Status)
	fmt.Printf("BlockNumber : %d\n", r.BlockNumber.Uint64())
	fmt.Printf("BlockHash   : %s\n", r.BlockHash.Hex())
	fmt.Printf("TxIndex     : %d\n", r.TransactionIndex)
	fmt.Printf("Gas Used    : %d\n", r.GasUsed)
	fmt.Printf("Logs        : %d\n", len(r.Logs))
	if len(r.Logs) > 0 {
		fmt.Printf("First Log Address : %s\n", r.Logs[0].Address.Hex())
	}
}

func trim0x(s string) string {
	if len(s) >= 2 && s[:2] == "0x" {
		return s[2:]
	}
	return s
}
