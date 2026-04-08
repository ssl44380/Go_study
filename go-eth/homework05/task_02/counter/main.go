package main

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"
	"time"

	counter "counter/bindings"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

const deployFile = "deployed.json"

type DeployedInfo struct {
	Address string `json:"countAddress"`
}

func main() {
	// 1.链接网络
	rpcURL := os.Getenv("ETH_RPC_URL")
	if rpcURL == "" {
		log.Fatal("ETH_RPC_URL is not set ")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		log.Fatalf("failed to connect to Ethereum node :%v", err)
	}
	defer client.Close()

	// 2.解析私钥
	privateKeyHex := os.Getenv("PRIVET_KEY")
	privateKey := loadPrivateKey(privateKeyHex)

	// 3.获取链ID
	chainID, err := client.ChainID(ctx)
	if err != nil {
		log.Fatalf("get chainID file:%v", err)
	}

	// 4. 创建签名器
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		log.Fatalf("create auth fail: %v", err)
	}

	// 5.绑定已经部署的合约
	var counter *counter.Counter
	if _, err := os.Stat(deployFile); os.IsNotExist(err) {
		counter = deployContract(auth, client)
	} else {
		contractAddress, _ := loadDeployedAddress()
		counter = bindContract(common.HexToAddress(contractAddress), client)
	}

	// 6.首次查询
	fristCount := queryCount(counter)
	fmt.Printf("fristCount  count = %s\n", fristCount.String())

	// 7.执行自增操作（需要花费gas）
	autoAddCounter(counter, auth, client)

	// 8.再次查询结果加一
	secondCount := queryCount(counter)
	fmt.Printf("secondCount  count = %s\n", secondCount.String())

}

func autoAddCounter(counter *counter.Counter, auth *bind.TransactOpts, client *ethclient.Client) {
	// 执行区块交易，提交区块
	tx, err := counter.Increment(auth)
	if err != nil {
		log.Fatalf("transcation fail: %v", err)
	}
	fmt.Printf("transcation send seccuss : %s\n", tx.Hash().Hex())
	// 等待区块上线
	receipt, err := bind.WaitMined(context.Background(), client, tx)
	if err != nil {
		log.Fatalf("transcation online fail : %v", err)
	}
	fmt.Printf("tramscation online success , block numer :%v \n", receipt.BlockNumber.Uint64())

}

func queryCount(count *counter.Counter) *big.Int {
	num, err := count.Number(nil)
	if err != nil {
		log.Fatalf("read Counter fail :%v", err)
	}
	return num
}

func loadPrivateKey(hexKey string) *ecdsa.PrivateKey {
	key, err := crypto.HexToECDSA(strings.TrimPrefix(hexKey, "0x"))
	if err != nil {
		log.Fatalf("publicKey parse file:%v", err)
	}
	return key
}

func trim0x(s string) string {
	if len(s) >= 2 && s[:2] == "0x" {
		return s[2:]
	}
	return s
}

func bindContract(addr common.Address, client *ethclient.Client) *counter.Counter {

	instance, err := counter.NewCounter(addr, client)
	if err != nil {
		log.Fatalf("bind fail : %v", err)
	}
	return instance
}

func deployContract(auth *bind.TransactOpts, client *ethclient.Client) *counter.Counter {

	addr, tx, instance, err := counter.DeployCounter(auth, client)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("deployment Hash: %v \n", tx.Hash().Hex())
	fmt.Printf("constranct addr: %v \n", addr.Hex())

	saveDeployedAddress(addr.Hex())
	return instance
}

func saveDeployedAddress(addr string) {
	info := DeployedInfo{Address: addr}
	data, _ := json.MarshalIndent(info, "", "  ")
	_ = os.WriteFile(deployFile, data, 0600)
	fmt.Printf("constranct address info save in %v \n", deployFile)
}

func loadDeployedAddress() (string, error) {

	if _, err := os.Stat(deployFile); os.IsNotExist(err) {
		return "", errors.New("deployed.json not exist!")
	}

	data, err := os.ReadFile(deployFile)
	if err != nil {
		return "", err
	}

	var info DeployedInfo
	err = json.Unmarshal(data, &info)
	if err != nil {
		return "", errors.New("JSON format error")
	}

	if info.Address == "" {
		return "", errors.New("address in empty ")
	}

	if !common.IsHexAddress(info.Address) {
		return "", errors.New("address unvalued")
	}

	return info.Address, nil
}
