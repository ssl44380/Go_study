// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract auctionTransparentProxy {
    // 🔥 标准 EIP-1967 存储槽（最安全）
    bytes32 private constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;


    // 错误定义
    error NotAdmin();
    error DelegatecallFailed();

    // 🔥 构造函数：使用安全存储槽
    constructor(address _impl) {
        _setImplementation(_impl);
    }

    // 🔥 只有管理员能升级
    function upgrade(address newImplementation) external {
        if (msg.sender != _admin()) revert NotAdmin();
        _setImplementation(newImplementation);
    }

    // 🔥 管理员不能执行业务逻辑（透明代理核心规则）
    fallback() external payable {
        if (msg.sender == _admin()) revert NotAdmin();

        address impl = _implementation();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            if iszero(result) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }

    // 🔥 必须加：支持接收 ETH
    receive() external payable {}

    // ------------------------------
    // 安全存储读写
    // ------------------------------
    function _implementation() internal view returns (address impl) {
        bytes32 slot = _IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }

    function _setImplementation(address newImpl) private {
        bytes32 slot = _IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, newImpl)
        }
    }

    function _admin() internal view returns (address adm) {
        bytes32 slot = _ADMIN_SLOT;
        assembly {
            adm := sload(slot)
        }
    }

}