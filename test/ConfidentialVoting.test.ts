import { expect } from "chai";
import { ethers } from "hardhat";
import type { ConfidentialVoting } from "../typechain-types";

describe("ConfidentialVoting (lightweight mock mode)", () => {
  let voting: ConfidentialVoting;
  let deployer: any, user: any;

  // Mock an externalEuint64 as a bytes-like payload
  function mockExternalEuint64(value: number): string {
    return ethers.hexlify(ethers.toUtf8Bytes(String(value)));
  }

  beforeEach(async () => {
    [deployer, user] = await ethers.getSigners();
    const Voting = await ethers.getContractFactory("ConfidentialVoting");
    voting = (await Voting.deploy(86400)) as unknown as ConfidentialVoting;
    await voting.waitForDeployment();

    // register user as voter (deployer is admin)
    await voting.registerVoter(user.address, "0x");
  });

  it("allows a registered voter to cast a mocked encrypted vote", async () => {
    const voteHandle = mockExternalEuint64(1);
    const weightHandle = mockExternalEuint64(1);

    await voting.connect(user).castVote(voteHandle, weightHandle, "0x", "0xdeadbeef");
    expect(await voting.hasVoted(user.address)).to.equal(true);
  });

  it("prevents non-registered addresses from voting", async () => {
    const nonRegistered = (await ethers.getSigners())[2];
    const voteHandle = mockExternalEuint64(1);
    const weightHandle = mockExternalEuint64(1);

    await expect(
      voting.connect(nonRegistered).castVote(voteHandle, weightHandle, "0x", "0x")
    ).to.be.revertedWith("Not registered");
  });

  it("admin can allow tally access and get encrypted tally handles", async () => {
    await voting.allowTallyAccess(user.address, "0x");
    const [yesHandle, noHandle] = await voting.getEncryptedTally();
    expect(ethers.isHexString(yesHandle)).to.be.true;
    expect(ethers.isHexString(noHandle)).to.be.true;
  });

  it("verify protocolId", async () => {
    const expectedId = ethers.keccak256(ethers.toUtf8Bytes("fhEVM Protocol")).slice(0, 10);
    expect(await voting.protocolId()).to.equal(expectedId);
  });
});
