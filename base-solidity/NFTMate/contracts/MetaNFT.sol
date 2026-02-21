// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MetaNFT is ERC721,Ownable {
    constructor() ERC721("MetaNFT", "MFT") Ownable(msg.sender) {}

    function mint(address to, uint256 id) external onlyOwner returns(uint256) {
        _safeMint(to, id);
        return id;
    }

    function burn(uint256 id) external onlyOwner {
        require(msg.sender == ownerOf(id), "not owner");
        _burn(id);
    }

}
