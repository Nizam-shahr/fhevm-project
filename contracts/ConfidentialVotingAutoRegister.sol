// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, ebool, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialVotingAutoRegister
/// @notice Encrypted yes/no weighted voting using Zama's FHEVM (Sepolia).
/// @dev Auto-registers the caller on first castVote. Includes init() to initialize ciphertexts.
contract ConfidentialVotingAutoRegister is SepoliaConfig {
    address public admin;

    // Encrypted tallies
    euint8 private totalYesVotes;
    euint8 private totalNoVotes;

    uint256 public votingEndTime;
    bool public initialized;

    mapping(address => bool) public isRegistered;
    mapping(address => bool) public hasVoted;

    event VoterRegistered(address indexed voter, bytes extraData);
    event VoteCast(address indexed voter, bytes extraData);
    event TallyAccessGranted(address indexed viewer, bytes extraData);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier votingOpen() {
        require(block.timestamp < votingEndTime, "Voting closed");
        _;
    }

    constructor(uint256 durationInSeconds) {
        require(durationInSeconds > 0, "Duration must be positive");
        admin = msg.sender;
        votingEndTime = block.timestamp + durationInSeconds;
    }

    function init() external onlyAdmin {
        require(!initialized, "Already initialized");
        totalYesVotes = FHE.asEuint8(0);
        totalNoVotes = FHE.asEuint8(0);
        initialized = true;
    }

    function registerVoter(address voter, bytes calldata extraData) external onlyAdmin {
        require(voter != address(0), "Zero address");
        require(!isRegistered[voter], "Already registered");
        isRegistered[voter] = true;
        emit VoterRegistered(voter, extraData);
    }

    function allowTallyAccess(address viewer, bytes calldata extraData) external onlyAdmin {
        require(viewer != address(0), "Zero address");
        FHE.allow(totalYesVotes, viewer);
        FHE.allow(totalNoVotes, viewer);
        emit TallyAccessGranted(viewer, extraData);
    }

    function makeTallyPublic() external onlyAdmin {
        FHE.makePubliclyDecryptable(totalYesVotes);
        FHE.makePubliclyDecryptable(totalNoVotes);
    }

    function getEncryptedTally() external view returns (euint8 yesHandle, euint8 noHandle) {
        return (totalYesVotes, totalNoVotes);
    }

    /// @notice Auto-registers unregistered voters and casts their encrypted vote
    function castVote(
        externalEuint8 voteHandle,
        externalEuint8 weightHandle,
        bytes calldata attestation,
        bytes calldata extraData
    ) external votingOpen {
        require(initialized, "Contract not initialized");

        if (!isRegistered[msg.sender]) {
            isRegistered[msg.sender] = true;
            emit VoterRegistered(msg.sender, extraData);
        }

        require(!hasVoted[msg.sender], "Already voted");

        euint8 vote = FHE.fromExternal(voteHandle, attestation);
        euint8 weight = FHE.fromExternal(weightHandle, attestation);

        euint8 one = FHE.asEuint8(1);
        euint8 yesInc = FHE.mul(vote, weight);
        euint8 noInc = FHE.mul(FHE.sub(one, vote), weight);

        totalYesVotes = FHE.add(totalYesVotes, yesInc);
        totalNoVotes = FHE.add(totalNoVotes, noInc);

        hasVoted[msg.sender] = true;
        emit VoteCast(msg.sender, extraData);

        FHE.allowThis(totalYesVotes);
        FHE.allowThis(totalNoVotes);
    }

    function grantMyVoteDecryptAccess(externalEuint8 voteHandle, bytes calldata attestation) external {
        require(isRegistered[msg.sender], "Not registered");
        euint8 vote = FHE.fromExternal(voteHandle, attestation);
        FHE.allow(vote, msg.sender);
    }

    function verifyVote(externalEuint8 voteHandle, bytes calldata attestation) external {
        euint8 vote = FHE.fromExternal(voteHandle, attestation);
        ebool isZero = FHE.eq(vote, FHE.asEuint8(0));
        ebool isOne = FHE.eq(vote, FHE.asEuint8(1));
        ebool isValid = FHE.or(isZero, isOne);
        FHE.allow(isValid, msg.sender);
    }
}
