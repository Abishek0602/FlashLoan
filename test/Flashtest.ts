import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { abi as abiFlashLoan } from "../artifacts/contracts/FlashLoan.sol/FlashLoan.json";

// ── Constants ──────────────────────────────────────────────────────────────
const WHALE_ADDR_BUSD = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3";
const WBNB  = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BUSD  = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const CAKE  = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const v3Fee = 500;
const BORROW_TOKEN = BUSD;

// ✅ Correct ABI — lowercase types, no extra keywords
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
];

// ── Fixture ────────────────────────────────────────────────────────────────
async function create_whale() {

    // 1. Impersonate FIRST before any calls
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [WHALE_ADDR_BUSD],
    });

    // 2. Fund whale with BNB for gas
    await network.provider.send("hardhat_setBalance", [
        WHALE_ADDR_BUSD,
        "0x56BC75E2D63100000",   // 100 BNB
    ]);

    // 3. ✅ await getSigner
    const whaleWallet = await ethers.provider.getSigner(WHALE_ADDR_BUSD);

    // 4. Verify BNB balance
    const bnbBalance = await whaleWallet.getBalance();
    console.log("Whale BNB:", ethers.utils.formatEther(bnbBalance));
    expect(bnbBalance.gt(0)).to.be.true;            // ✅ BigNumber comparison

    // 5. Verify BUSD balance
    const busdContract = new ethers.Contract(
        BORROW_TOKEN,
        ERC20_ABI,                                  // ✅ correct ABI
        ethers.provider
    );
    const busdBalance = await busdContract.balanceOf(WHALE_ADDR_BUSD);
    console.log("Whale BUSD:", ethers.utils.formatUnits(busdBalance, 18));
    expect(busdBalance.gt(0)).to.be.true;           // ✅ BigNumber comparison

    return { whaleWallet, busdContract };
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("Binance FlashLoan", function () {
    describe("deploy and Testing", function () {
        it("deploy and perform FlashLoan", async function () {

            // ── Load fixture ──────────────────────────────────────────────
            const { whaleWallet, busdContract } = await loadFixture(create_whale);

            // ── Deploy FlashLoan ──────────────────────────────────────────
            const FlashLoanFactory = await ethers.getContractFactory("FlashLoan");
            const flashloan = await FlashLoanFactory.deploy(WBNB, BUSD, v3Fee);
            await flashloan.deployed();
            console.log("FlashLoan deployed at:", flashloan.address);

            // ── Seed contract with 20 BUSD from whale ─────────────────────
            const seedAmount = ethers.utils.parseUnits("20", 18);
            const busdAsWhale = busdContract.connect(whaleWallet);  // ✅ reuse contract, just connect signer

            const transferTx = await busdAsWhale.transfer(flashloan.address, seedAmount);
            const transferReceipt = await transferTx.wait();
            expect(transferReceipt.status).to.equal(1);

            const balBefore = await busdContract.balanceOf(flashloan.address);
            console.log("Contract BUSD before:", ethers.utils.formatUnits(balBefore, 18));

            // ── FlashLoan params ──────────────────────────────────────────
            const amountBorrow = ethers.utils.parseUnits("30", 18);
           const tokenPath    = [CAKE, WBNB]; // const tokenPath = [WBNB, CAKE]; 
            const routing      = [0, 0, 0];

            // ── Connect FlashLoan contract as whale ───────────────────────
            const contractFlashLoan = new ethers.Contract(
                flashloan.address,
                abiFlashLoan,
                whaleWallet
            );

            // ── Execute FlashLoan ─────────────────────────────────────────
            const flashloanTx = await contractFlashLoan.flashloanRequest(
                tokenPath,
                0,
                amountBorrow,
                v3Fee,
                routing
            );
            const flashloanReceipt = await flashloanTx.wait();
            expect(flashloanReceipt.status).to.equal(1);

            // ── Check result ──────────────────────────────────────────────
            const balAfter = await busdContract.balanceOf(flashloan.address);
            console.log("Contract BUSD after:", ethers.utils.formatUnits(balAfter, 18));
        });
    });
});