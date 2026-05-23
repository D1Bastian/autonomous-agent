// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentIdentity
 * @dev ERC‑721 token representing an autonomous AI agent's on‑chain identity (ERC‑8004 compatible).
 * The token URI points to a JSON "agent card" containing metadata such as service endpoints, reputation contracts, etc.
 */
contract AgentIdentity is ERC721, Ownable {
    uint256 public nextTokenId = 1;
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("AgentIdentity", "AGENT") {}

    /**
     * @dev Mint a new identity token to `to` with metadata URI `uri`.
     * Only the contract owner (deployer) can mint.
     */
    function mint(address to, string memory uri) external onlyOwner returns (uint256) {
        uint256 tokenId = nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        nextTokenId++;
        return tokenId;
    }

    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        require(_exists(tokenId), "ERC721Metadata: URI set of nonexistent token");
        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return _tokenURIs[tokenId];
    }
}
