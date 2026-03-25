// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// 直接从 OpenZeppelin 导入
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// 什么都不用写！只需要继承即可
contract UUPSProxy is ERC1967Proxy {
    constructor(address _logic, bytes memory _data) ERC1967Proxy(_logic, _data) {}
}