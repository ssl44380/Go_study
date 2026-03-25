// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MetaNFT is ERC721,Ownable {
    uint256 public nftId;
    constructor() ERC721("MetaNFT", "MFT") Ownable(msg.sender) {
        nftId=1;
    }

    function mint(address to) external onlyOwner returns(uint256) {
        uint256 currentId = nftId;
        _safeMint(to, currentId);
        nftId++;
        return currentId;
    }

    function burn(uint256 id) external   {
        require(msg.sender == ownerOf(id), "not owner");
        _burn(id);
    }

}
