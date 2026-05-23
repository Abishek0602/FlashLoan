import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";

/* =========================================================
   TOKENS
========================================================= */

const TOKENS: Record<string, string> = {
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  DAI:  "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",

  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",

  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  ETH:  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  BTCB: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  XRP:  "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBe",
  ADA:  "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47",
  DOT:  "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402",
  DOGE: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43",

  LINK: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD",
  MATIC:"0xCC42724C6683B7E57334c4E856f4c9965ED682bD",
  TRX:  "0xCE7de646e7208A4Ef112CB6ed5038FA6CC6b12e3",
  UNI:  "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1",
  LTC:  "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94",
  XVS:  "0xcF6BB5389c92Bdda8a3747Ddb454cB7A64626C63",
  AAVE: "0xfb6115445Bff7b52FeB98650C87f44907E58f802",
  ATOM: "0x0Eb3a705fc54725037CC9e008bDede697f62F335",
};

/* =========================================================
   DEX ROUTERS
========================================================= */

const PANCAKE_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const BISWAP_V2  = "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8";
const APESWAP_V2 = "0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b";
const BABYSWAP_V2= "0x325E343f1dE602396E256B67eFd1F61C3A6B38Bd";

const PANCAKE_V3_QUOTER =
  "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997";

/* =========================================================
   ABIs
========================================================= */

const V2_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
];

const V3_QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn,address tokenOut,uint24 fee,uint256 amountIn,uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
];

/* =========================================================
   CONFIG
========================================================= */

const BORROW_SIZES = [
  "100",
  "250",
  "500",
  "1000",
  "2500",
];

const V3_FEES = [
  100,
  500,
  2500,
  10000,
];

const FLASH_FEE_BPS = 25;

const GAS_COST_USD = 1.0;

/* =========================================================
   TYPES
========================================================= */

interface DexOption {
  contract: Contract | null;
  label: string;
  routing: number;
  type: number;
  fee: number;
}

interface ArbResult {
  borrow: string;

  base: string;
  hop1: string;
  hop2: string;

  dex1: string;
  dex2: string;
  dex3: string;

  routing: number[];

  amountOut: BigNumber;
  profit: BigNumber;

  profitFormatted: string;

  v3Fee: number;
}

/* =========================================================
   HELPERS
========================================================= */

async function quoteV2(
  router: Contract,
  amountIn: BigNumber,
  path: string[]
): Promise<BigNumber> {
  try {
    const amounts = await router.getAmountsOut(
      amountIn,
      path
    );

    return amounts[amounts.length - 1];
  } catch {
    return BigNumber.from(0);
  }
}

async function quoteV3(
  quoter: Contract,
  tokenIn: string,
  tokenOut: string,
  fee: number,
  amountIn: BigNumber
): Promise<BigNumber> {
  try {
    return await quoter.callStatic.quoteExactInputSingle(
      tokenIn,
      tokenOut,
      fee,
      amountIn,
      0
    );
  } catch {
    return BigNumber.from(0);
  }
}

function format(num: BigNumber): string {
  return parseFloat(
    ethers.utils.formatUnits(num, 18)
  ).toFixed(6);
}

/* =========================================================
   MAIN
========================================================= */

async function main() {

  const provider = ethers.provider;

  /* =====================================================
     DEX CONTRACTS
  ===================================================== */

  const pancakeV2 = new ethers.Contract(
    PANCAKE_V2,
    V2_ABI,
    provider
  );

  const biswapV2 = new ethers.Contract(
    BISWAP_V2,
    V2_ABI,
    provider
  );

  const apeswapV2 = new ethers.Contract(
    APESWAP_V2,
    V2_ABI,
    provider
  );

  const babyswapV2 = new ethers.Contract(
    BABYSWAP_V2,
    V2_ABI,
    provider
  );

  const v3Quoter = new ethers.Contract(
    PANCAKE_V3_QUOTER,
    V3_QUOTER_ABI,
    provider
  );

  /* =====================================================
     DEX OPTIONS
  ===================================================== */

  const dexes: DexOption[] = [

    {
      contract: pancakeV2,
      label: "Pancake V2",
      routing: 0,
      type: 0,
      fee: 0,
    },

    {
      contract: biswapV2,
      label: "Biswap V2",
      routing: 0,
      type: 0,
      fee: 0,
    },

    {
      contract: apeswapV2,
      label: "Apeswap V2",
      routing: 0,
      type: 0,
      fee: 0,
    },

    {
      contract: babyswapV2,
      label: "Babyswap V2",
      routing: 0,
      type: 0,
      fee: 0,
    },
  ];

  /* =====================================================
     ADD V3 FEES
  ===================================================== */

  for (const fee of V3_FEES) {
    dexes.push({
      contract: null,
      label: `Pancake V3(${fee})`,
      routing: 1,
      type: 1,
      fee,
    });
  }

  /* =====================================================
     TOKENS
  ===================================================== */

  const baseTokens = [
    "BUSD",
    "USDT",
    "USDC",
    "DAI",
    "WBNB",
  ];

  const hopTokens = Object.keys(TOKENS)
    .filter(t => !baseTokens.includes(t));

  const profitable: ArbResult[] = [];

  let scanned = 0;

  console.log("\n=======================================");
  console.log("     ADVANCED BSC ARB SCANNER");
  console.log("=======================================\n");

  /* =====================================================
     BORROW SIZES
  ===================================================== */

  for (const borrowStr of BORROW_SIZES) {

    const BORROW = ethers.utils.parseUnits(
      borrowStr,
      18
    );

    console.log(`Scanning borrow size: ${borrowStr}`);

    /* ===================================================
       BASE TOKEN
    =================================================== */

    for (const base of baseTokens) {

      const baseAddr = TOKENS[base];

      /* =================================================
         HOP COMBINATIONS
      ================================================= */

      for (let i = 0; i < hopTokens.length; i++) {

        for (let j = i + 1; j < hopTokens.length; j++) {

          const permutations = [
            [hopTokens[i], hopTokens[j]],
            [hopTokens[j], hopTokens[i]],
          ];

          /* =============================================
             BOTH DIRECTIONS
          ============================================= */

          for (const [hop1, hop2] of permutations) {

            const hop1Addr = TOKENS[hop1];
            const hop2Addr = TOKENS[hop2];

            /* ===========================================
               DEX COMBINATIONS
            =========================================== */

            for (const d1 of dexes) {

              let amt1 = BigNumber.from(0);

              if (d1.type === 0) {

                amt1 = await quoteV2(
                  d1.contract!,
                  BORROW,
                  [baseAddr, hop1Addr]
                );

                // try multihop
                if (amt1.isZero()) {
                  amt1 = await quoteV2(
                    d1.contract!,
                    BORROW,
                    [baseAddr, TOKENS.WBNB, hop1Addr]
                  );
                }

              } else {

                amt1 = await quoteV3(
                  v3Quoter,
                  baseAddr,
                  hop1Addr,
                  d1.fee,
                  BORROW
                );
              }

              if (amt1.isZero()) continue;

              for (const d2 of dexes) {

                let amt2 = BigNumber.from(0);

                if (d2.type === 0) {

                  amt2 = await quoteV2(
                    d2.contract!,
                    amt1,
                    [hop1Addr, hop2Addr]
                  );

                  if (amt2.isZero()) {
                    amt2 = await quoteV2(
                      d2.contract!,
                      amt1,
                      [hop1Addr, TOKENS.WBNB, hop2Addr]
                    );
                  }

                } else {

                  amt2 = await quoteV3(
                    v3Quoter,
                    hop1Addr,
                    hop2Addr,
                    d2.fee,
                    amt1
                  );
                }

                if (amt2.isZero()) continue;

                for (const d3 of dexes) {

                  let amt3 = BigNumber.from(0);

                  if (d3.type === 0) {

                    amt3 = await quoteV2(
                      d3.contract!,
                      amt2,
                      [hop2Addr, baseAddr]
                    );

                    if (amt3.isZero()) {
                      amt3 = await quoteV2(
                        d3.contract!,
                        amt2,
                        [hop2Addr, TOKENS.WBNB, baseAddr]
                      );
                    }

                  } else {

                    amt3 = await quoteV3(
                      v3Quoter,
                      hop2Addr,
                      baseAddr,
                      d3.fee,
                      amt2
                    );
                  }

                  if (amt3.isZero()) continue;

                  scanned++;

                  /* ===============================
                     PROFIT
                  =============================== */

                  const flashFee = BORROW
                    .mul(FLASH_FEE_BPS)
                    .div(10000);

                  const repay = BORROW.add(flashFee);

                  if (amt3.lte(repay)) continue;

                  const profit = amt3.sub(repay);

                  const profitFormatted = format(profit);

                  if (
                    parseFloat(profitFormatted)
                    < GAS_COST_USD
                  ) continue;

                  /* ===============================
                     LOG
                  =============================== */

                  console.log(
                    `✅ ${base} → ${hop1} → ${hop2} → ${base}`
                  );

                  console.log(
                    `   Borrow : ${borrowStr}`
                  );

                  console.log(
                    `   DEXES  : ${d1.label} | ${d2.label} | ${d3.label}`
                  );

                  console.log(
                    `   Profit : +${profitFormatted} ${base}`
                  );

                  console.log("");

                  profitable.push({

                    borrow: borrowStr,

                    base,
                    hop1,
                    hop2,

                    dex1: d1.label,
                    dex2: d2.label,
                    dex3: d3.label,

                    routing: [
                      d1.routing,
                      d2.routing,
                      d3.routing,
                    ],

                    amountOut: amt3,

                    profit,

                    profitFormatted,

                    v3Fee:
                      d1.fee ||
                      d2.fee ||
                      d3.fee ||
                      500,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  /* =====================================================
     RESULTS
  ===================================================== */

  console.log("\n=======================================");
  console.log(`ROUTES SCANNED : ${scanned}`);
  console.log(`PROFITABLE     : ${profitable.length}`);
  console.log("=======================================\n");

  if (profitable.length === 0) {

    console.log("❌ No profitable routes found");

    return;
  }

  profitable.sort((a, b) =>
    b.profit.gt(a.profit) ? 1 : -1
  );

  const best = profitable[0];

  console.log("🏆 BEST ROUTE\n");

  console.log(
    `PATH     : ${best.base} → ${best.hop1} → ${best.hop2} → ${best.base}`
  );

  console.log(
    `DEXES    : ${best.dex1} | ${best.dex2} | ${best.dex3}`
  );

  console.log(
    `BORROW   : ${best.borrow}`
  );

  console.log(
    `ROUTING  : [${best.routing.join(", ")}]`
  );

  console.log(
    `V3 FEE   : ${best.v3Fee}`
  );

  console.log(
    `PROFIT   : +${best.profitFormatted} ${best.base}`
  );

  console.log("\n=======================================");
  console.log("COPY INTO TEST");
  console.log("=======================================\n");

  console.log(
    `const tokenPath = ["${TOKENS[best.hop1]}", "${TOKENS[best.hop2]}"];`
  );

  console.log(
    `const routing = [${best.routing.join(", ")}];`
  );

  console.log(
    `const v3Fee = ${best.v3Fee};`
  );

  console.log(
    `const amountBorrow = ethers.utils.parseUnits("${best.borrow}", 18);`
  );
}

/* =========================================================
   RUN
========================================================= */

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });