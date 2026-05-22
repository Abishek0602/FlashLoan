import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {ethers, network} from "hardhat";

import { abi as abiFlashLoan } from "../artifacts/contracts/FlashLoan.sol/FlashLoan.json"

const WHALE_ADDR_BUSD = "0x28C6c06298d514Db089934071355E5743bf21d60";

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const v3Fee = 500;
const BORROW_TOKEN = BUSD;

describe("Binance FlashLoan", function() {
   
    

    describe("deploy and Testing", function(){
        it("deploy and perform FlashLoan", async function(){
        
        // let { whaleWallet } = await loadFixture(create_whale)

         const FlashLoan = await ethers.getContractFactory("FlashLoan");
         let flashloan = await FlashLoan.deploy(WBNB,BUSD,500)
         await flashloan.deployed();

         console.log("FlashLoan contract deployed At: \t", flashloan.address)

         

         // Initilize FlashLoan Paras
         const amountBorrow = ethers.utils.parseUnits("30", 18);
         const tokenPath =[CAKE,WBNB];
         const routing = [1,0,0];
         const v3Fee = 500;

         // create signer
         const [signer] =await ethers.getSigners();

        // connect FlashLoan Contract
        const contractFlashLoan = new ethers.Contract(
            flashloan.address,
            abiFlashLoan,
            signer
        );

        // call FlashLoan request function
        const txtFlashloan = await contractFlashLoan.flashloanRequest(
            tokenPath,
            0,
            amountBorrow,
            v3Fee,
            routing
        );

        // show the result

        const txtFlashloanReceipt = await txtFlashloan.wait();
        expect(txtFlashloanReceipt.status).to.eql(1);


        
    }); 
    });
    
});