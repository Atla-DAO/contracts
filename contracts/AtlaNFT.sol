// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

contract AtlaNFT is ERC721, AccessControl, VRFConsumerBase {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    
    /// Minter role. An address with this role is allowed to mint new Stardust.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    bytes32 internal keyHash;

    /// Random Token ID selected for reward
    uint256 public rewardTokenId;
        
    // VRF Coordinator
    // LINK token
    constructor() 
        VRFConsumerBase(
            0x3d2341ADb2D31f1c5530cDC622016af293177AE0,
            0xb0897686c545045aFc77CF20eC7A532E3120E0F1
        )
        ERC721(
            "Atla DAO NFT", 
            "ATLA-NFT"
        ) {
        keyHash = 0xf86195cf7690c55907b2b611ebb7343a6f649bff128701cc542f0569e2c549da;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }

    function safeMint(address to) public onlyRole(MINTER_ROLE) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }

    /** 
     * Requests randomness 
     */
    function getRandomNumber() public returns (bytes32 requestId) {
        require(LINK.balanceOf(address(this)) >= 0.0001 * 10 ** 18, "!$LINK");
        return requestRandomness(keyHash, 0.0001 * 10 ** 18);
    }

    /**
     * Callback function used by VRF Coordinator
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        console.logUint(randomness);
        rewardTokenId = randomness;
    }

    /**
     * Withdraw LINK from this contract
     */
    function withdrawLink() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(LINK.transfer(msg.sender, LINK.balanceOf(address(this))), "Unable to transfer");
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

}