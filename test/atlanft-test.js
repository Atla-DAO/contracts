const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Web3Utils, numberToHex } = require("web3-utils");
const linkABI = require('../artifacts/@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol/LinkTokenInterface.json') 
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");
const {
  web3tx,
  toWad,
  wad4human,
  fromDecimals,
  BN,
} = require('@decentral.ee/web3-helpers');
const { time } = require('@openzeppelin/test-helpers');
const traveler = require('ganache-time-traveler');

function web3StringToBytes32(text) {
  var result = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(text));
  while (result.length < 66) { result += '0'; }
  if (result.length !== 66) { throw new Error("invalid web3 implicit bytes32"); }
  return result;
}

let my_accounts = ["0xc41876DAB61De145093b6aA87417326B24Ae4ECD","0xf40C0a8D9bCf57548a6afF14374ac02D2824660A","0xcF4B5f6CCD39a2b5555dDd9e23F3d0b11843086e"]

async function impersonateAccount(account) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [account],
  });
}

async function setBalance(account, balance) {
  const hexBalance = numberToHex(toWad(balance));
  await hre.network.provider.request({
    method: 'hardhat_setBalance',
    params: [
      account,
      hexBalance,
    ],
  });
}

async function impersonateAndSetBalance(account) {
  await impersonateAccount(account);
  await setBalance(account, 10000);
}

describe("RevenueSplitter", function () {

  let atlanft;
  let linkToken;
  let alice;
  let bob;
  let mike;

  const ALICE_ADDRESS = '0xd964aB7E202Bab8Fbaa28d5cA2B2269A5497Cf68';
  const BOB_ADDRESS = '0xcF4B5f6CCD39a2b5555dDd9e23F3d0b11843086e';
  const MIKE_ADDRESS = '0xcF4B5f6CCD39a2b5555dDd9e23F3d0b11843086e';
  const LINK_TOKEN_ADDRESS = '0xb0897686c545045aFc77CF20eC7A532E3120E0F1';

  before(async function () {

    const accountAddrs = [ALICE_ADDRESS, BOB_ADDRESS, MIKE_ADDRESS];

    accountAddrs.forEach(async (account) => {
      await impersonateAndSetBalance(account);
    });

    // get signers
    alice = await ethers.provider.getSigner(ALICE_ADDRESS);
    bob = await ethers.provider.getSigner(BOB_ADDRESS);
    carl = await ethers.provider.getSigner(MIKE_ADDRESS);
    const accounts = [alice, bob, carl];

    // Deploy AtlaNFT contract
    const AtlaNFT = await ethers.getContractFactory("AtlaNFT",{signer:alice});
    atlanft = await AtlaNFT.deploy();
    atlanft.deployed();

    // Set linkToken and wiew Alice's $LINK balance
    linkToken = await ethers.getContractAt(linkABI.abi, LINK_TOKEN_ADDRESS);
    console.log("Alice's $LINK Balance: ", parseInt( (await linkToken.balanceOf(alice._address))._hex , 16) / (10**18) )

    // Get VRFCoordinatorMock contract
    const VRFCoordinatorMock = await ethers.getContractFactory("VRFCoordinatorMock");
    vrfCoordinatorMock = await VRFCoordinatorMock.deploy(linkToken.address);


  });

  describe("Proper role controls", async function () {
    it("admin can set another minter", async function () {

      await expect( atlanft.connect(bob).safeMint(
        bob._address
      ) ).to.be.reverted;
      
      // Alice (admin) grants Bob the minter role
      await atlanft.connect(alice).grantRole(
        await atlanft.MINTER_ROLE(), // Instead of trying to pass in the bytes32, role retreived straight from the contract
        bob._address,
      );

      // Bob mints Alice an NFT
      await atlanft.connect(bob).safeMint(
        alice._address,
      );

      // Verify that Alice now has an NFT
      await expect( (await atlanft.balanceOf(alice._address)).toNumber() ).to.equal(1);

    });
  });

  describe("Checking random reward dispersal", async function () {
    it("verify random number generation", async function () {

      // Alice must transfer some LINK into the contract to pay for request
      await linkToken.connect(alice).transfer(atlanft.address,(10**18).toString());

      // Alice mints Alice an NFT
      await atlanft.connect(alice).safeMint(
        alice._address,
      );

      // Alice mints Alice an NFT
      await atlanft.connect(alice).safeMint(
        alice._address,
      );

      // Alice mints Alice an NFT
      await atlanft.connect(alice).safeMint(
        alice._address,
      );

      // Make random number request
      const randomNumberTransaction = await atlanft.connect(alice).getRandomNumber();
      let tx_receipt = await randomNumberTransaction.wait()
      let requestId = tx_receipt.events[2].topics[0]

      console.log(requestId)

      // Force random number fulfillment
      let tx = await vrfCoordinatorMock.callBackWithRandomness(requestId, '777', atlanft.address)

      // Retrieve random number from rewardTokenId state variable
      let randomNumber = (await atlanft.rewardTokenId()).toNumber()
      console.log("VRF Output", randomNumber );

    });
  });

});
