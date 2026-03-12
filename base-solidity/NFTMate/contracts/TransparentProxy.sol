// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


contract TransparentProxy {
    // bytes32 private constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // bytes32 private constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    address implementation;
    address admin;
    string public words;
    constructor (address _impl1){
        admin=msg.sender;
        implementation = _impl1;
    }

    fallback()external payable{
        require(msg.sender!=admin);
        (bool success,bytes memory data)=implementation.delegatecall(msg.data);
        require(success);
        assembly {
            return(add(data, 32), mload(data))
        }
    }

    function upgrade(address newImplementation)external{
        if (msg.sender!=admin) revert();
        implementation=newImplementation;
    }

}