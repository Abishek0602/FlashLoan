import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";

/* =========================================================
   TOKENS
========================================================= */
const TOKENS: Record<string, string> = {
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  ETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  BTCB: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
};

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
   DEX ADDRESSES
========================================================= */
const PANCAKE_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

const PANCAKE_V3_QUOTER =
  "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997";

const BISWAP_V2 = "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8";

/* =========================================================
   HELPERS
========================================================= */

async function quoteV2(
  router: Contract,
  amountIn: BigNumber,
  tokenIn: string,
  tokenOut: string
): Promise<BigNumber> {
  try {
    const amounts = await router.getAmountsOut(amountIn, [
      tokenIn,
      tokenOut,
    ]);

    return amounts[1];
  } catch (err) {
    return BigNumber.from(0);
  }
}

async function quoteV3(
  quoter: Contract,
  amountIn: BigNumber,
  tokenIn: string,
  tokenOut: string,
  fee: number
): Promise<BigNumber> {
  try {
    const out = await quoter.callStatic.quoteExactInputSingle(
      tokenIn,
      tokenOut,
      fee,
      amountIn,
      0
    );

    return out;
  } catch (err) {
    return BigNumber.from(0);
  }
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  const provider = ethers.provider;

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

  const v3Quoter = new ethers.Contract(
    PANCAKE_V3_QUOTER,
    V3_QUOTER_ABI,
    provider
  );

  /* =========================================================
     ROUTES
  ========================================================= */

  // [base, hop1, hop2, dex1, dex2, dex3, v3Fee]

  const routes: any[] = [
    // BUSD → WBNB → CAKE → BUSD
    ["BUSD", "WBNB", "CAKE", "pcv2", "pcv2", "pcv2", 500],
    ["BUSD", "WBNB", "CAKE", "pcv3", "pcv2", "pcv2", 500],
    ["BUSD", "WBNB", "CAKE", "pcv2", "pcv2", "biv2", 500],

    // BUSD → CAKE → WBNB → BUSD
    ["BUSD", "CAKE", "WBNB", "pcv2", "pcv2", "pcv2", 500],
    ["BUSD", "CAKE", "WBNB", "pcv3", "pcv2", "pcv2", 500],
    ["BUSD", "CAKE", "WBNB", "biv2", "pcv2", "pcv3", 500],

    // BUSD → ETH → WBNB → BUSD
    ["BUSD", "ETH", "WBNB", "pcv2", "pcv2", "pcv2", 500],
    ["BUSD", "ETH", "WBNB", "pcv3", "pcv2", "pcv2", 500],
    ["BUSD", "ETH", "WBNB", "biv2", "pcv2", "biv2", 500],

    // BUSD → BTCB → WBNB → BUSD
    ["BUSD", "BTCB", "WBNB", "pcv2", "pcv2", "pcv2", 500],
    ["BUSD", "BTCB", "WBNB", "pcv3", "pcv2", "pcv2", 500],

    // USDT → WBNB → CAKE → USDT
    ["USDT", "WBNB", "CAKE", "pcv2", "pcv2", "pcv2", 500],
    ["USDT", "WBNB", "CAKE", "biv2", "pcv2", "biv2", 500],

    // WBNB → CAKE → BUSD → WBNB
    ["WBNB", "CAKE", "BUSD", "pcv2", "pcv2", "pcv2", 500],
    ["WBNB", "CAKE", "USDT", "pcv2", "pcv2", "pcv2", 500],
  ];

  /* =========================================================
     CONFIG
  ========================================================= */

  const BORROW = ethers.utils.parseUnits("1000", 18);

  // 0.25%
  const FEE_BPS = 25;

  console.log("\n================================================");
  console.log("          MANUAL ROUTE QUOTE CHECKER");
  console.log("================================================");

  console.log(
    `Borrow: 1000 tokens | Flash Fee: ${FEE_BPS / 100}%`
  );

  console.log("");

  const profitable: any[] = [];

  /* =========================================================
     CHECK ROUTES
  ========================================================= */

  for (const route of routes) {
    const [base, hop1, hop2, dex1, dex2, dex3, fee] = route;

    const baseAddr = TOKENS[base];
    const hop1Addr = TOKENS[hop1];
    const hop2Addr = TOKENS[hop2];

    const v3Fee = fee as number;

    /* =====================================================
       LEG 1
    ===================================================== */

    let amt1 = BigNumber.from(0);

    if (dex1 === "pcv2") {
      amt1 = await quoteV2(
        pancakeV2,
        BORROW,
        baseAddr,
        hop1Addr
      );
    } else if (dex1 === "biv2") {
      amt1 = await quoteV2(
        biswapV2,
        BORROW,
        baseAddr,
        hop1Addr
      );
    } else if (dex1 === "pcv3") {
      amt1 = await quoteV3(
        v3Quoter,
        BORROW,
        baseAddr,
        hop1Addr,
        v3Fee
      );
    }

    if (amt1.isZero()) continue;

    /* =====================================================
       LEG 2
    ===================================================== */

    let amt2 = BigNumber.from(0);

    if (dex2 === "pcv2") {
      amt2 = await quoteV2(
        pancakeV2,
        amt1,
        hop1Addr,
        hop2Addr
      );
    } else if (dex2 === "biv2") {
      amt2 = await quoteV2(
        biswapV2,
        amt1,
        hop1Addr,
        hop2Addr
      );
    } else if (dex2 === "pcv3") {
      amt2 = await quoteV3(
        v3Quoter,
        amt1,
        hop1Addr,
        hop2Addr,
        v3Fee
      );
    }

    if (amt2.isZero()) continue;

    /* =====================================================
       LEG 3
    ===================================================== */

    let amt3 = BigNumber.from(0);

    if (dex3 === "pcv2") {
      amt3 = await quoteV2(
        pancakeV2,
        amt2,
        hop2Addr,
        baseAddr
      );
    } else if (dex3 === "biv2") {
      amt3 = await quoteV2(
        biswapV2,
        amt2,
        hop2Addr,
        baseAddr
      );
    } else if (dex3 === "pcv3") {
      amt3 = await quoteV3(
        v3Quoter,
        amt2,
        hop2Addr,
        baseAddr,
        v3Fee
      );
    }

    if (amt3.isZero()) continue;

    /* =====================================================
       PROFIT
    ===================================================== */

    const flashFee = BORROW.mul(FEE_BPS).div(10000);

    const repayAmt = BORROW.add(flashFee);

    const profitableRoute = amt3.gt(repayAmt);

    const delta = profitableRoute
      ? amt3.sub(repayAmt)
      : repayAmt.sub(amt3);

    const deltaStr = parseFloat(
      ethers.utils.formatUnits(delta, 18)
    ).toFixed(6);

    const sign = profitableRoute ? "+" : "-";

    console.log(`${base} → ${hop1} → ${hop2} → ${base}`);

    console.log(`DEX : ${dex1} | ${dex2} | ${dex3}`);

    console.log(
      `OUT : ${ethers.utils.formatUnits(amt3, 18)}`
    );

    console.log(
      `P/L : ${sign}${deltaStr} ${base} ${
        profitableRoute ? "✅" : "❌"
      }`
    );

    console.log(
      "------------------------------------------------"
    );

    if (profitableRoute) {
      profitable.push({
        base,
        hop1,
        hop2,
        dex1,
        dex2,
        dex3,
        fee,
        delta,
        amt3,
      });
    }
  }

  /* =========================================================
     BEST ROUTE
  ========================================================= */

  if (profitable.length === 0) {
    console.log(
      "\n❌ No profitable routes found at this block."
    );

    console.log(
      "Try removing blockNumber pin in hardhat.config.ts"
    );

    return;
  }

  profitable.sort((a, b) =>
    b.delta.gt(a.delta) ? 1 : -1
  );

  const best = profitable[0];

  const routingMap: Record<string, number> = {
    pcv2: 0,
    biv2: 0,
    pcv3: 1,
  };

  console.log("\n🏆 BEST ROUTE FOUND:");

  console.log(
    `   ${best.base} → ${best.hop1} → ${best.hop2} → ${best.base}`
  );

  console.log(
    `   DEX : ${best.dex1} | ${best.dex2} | ${best.dex3}`
  );

  console.log(
    `   PROFIT : +${ethers.utils.formatUnits(
      best.delta,
      18
    )} ${best.base}`
  );

  console.log("\n📋 PASTE INTO test.ts:\n");

  console.log(
    `const tokenPath = ["${TOKENS[best.hop1]}", "${TOKENS[best.hop2]}"];`
  );

  console.log(
    `const routing = [${routingMap[best.dex1]}, ${routingMap[best.dex2]}, ${routingMap[best.dex3]}];`
  );

  console.log(`const v3Fee = ${best.fee};`);

  console.log(
    `const amountBorrow = ethers.utils.parseUnits("1000", 18);`
  );
}

/* =========================================================
   RUN
========================================================= */

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });