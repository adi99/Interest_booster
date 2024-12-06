import algosdk from 'algosdk';
import {
  prepareCreateUserLoan,
  prepareDepositIntoPool,
  prepareSyncCollateralInLoan,
  prepareBorrowFromLoan,
  TestnetPools,
  prepareAddCollateralToLoan,
  wrapWithFlashLoan,
  prefixWithOpUp,
  TestnetReserveAddress,
} from 'folks-finance-js-sdk';
import { PactClient } from '@pactfi/pactsdk'; // Import PactFi SDK

// Algod and Indexer Clients
const baseServer = 'https://testnet-api.algonode.cloud';
const algodClient = new algosdk.Algodv2('', baseServer, '');
// const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud/', '');

const loanAppId = 168153622;
const poolManagerAppId = 147157634;
const oracle = {
  oracle0AppId: 124087437,
  oracleAdapterAppId: 147153711,
  decimals: 14,
};
const opup = { callerAppId: 397104542, baseAppId: 118186203 };
const budget = Math.ceil(10);

// PactFi client initialization
const pactClient = new PactClient(algodClient, {network: "testnet"});

export async function strategy1(userAccount, depositAmount, loanName) {
  try {
    const params = await algodClient.getTransactionParams().do();
    const pools = TestnetPools;

    // Deposit allocations
    const usdcAllocation = depositAmount * 0.3 * 1e6; // 30% to USDC
    const lpAllocation = depositAmount * 0.4 * 1e6; // 40% to liquidity pool
    const leverageAllocation = depositAmount * 0.3 * 1e6; // 30% to leverage strategy

    // Flash loan settings
    const flashLoanAmount = leverageAllocation * 2.5;
    const flashLoanRepaymentAmount = Math.floor(flashLoanAmount * 1.0016); // 16 bp fee

    const note = new Uint8Array(Buffer.from(`ff/v1:j{"name":"${loanName}"}`));

    // Step 1: USDC deposit using Folks Finance
    const usdcDepositTxn = prepareDepositIntoPool(
      pools.USDC,
      poolManagerAppId,
      userAccount.addr,
      userAccount.addr,
      usdcAllocation,
      params,
      note
    );

    const algo = await pactClient.fetchAsset(0)
    const usdc = await pactClient.fetchAsset(37074699)
    const pool = await pactClient.fetchPoolsByAssets(algo, usdc)[0];
    const optInUsdc = await usdc.prepareOptInTx(userAccount.addr);
    // Opt-in for liquidity token.
    const plpOptInTxn = await pool.liquidityAsset.prepareOptInTx(userAccount.addr);

    // Do a zap.
    const zapTxn = pool.prepareZap({
    asset: algo,
    amount: lpAllocation,
    slippagePct: 1,
    });
    const zapTxGroup = await zapTxn.prepareTxGroup(userAccount.addr);

    // Step 3: Leverage strategy
    const { txns: openLoanTxns, escrow } = prepareCreateUserLoan(loanAppId, userAccount.addr, params);
    const escrowAccount = { addr: escrow.addr, sk: escrow.sk };

    const fund_txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: userAccount.addr,
      to: escrow.addr,
      amount: 1000000,
      suggestedParams: params,
      note,
    });

    // Asset opt-in transaction for escrow account
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: escrow.addr,
        to: escrow.addr,
        amount: 0,
        assetIndex: 147171698,
        suggestedParams: params,
      });

    // Leverage transaction 
    const depositTxn = prepareDepositIntoPool(
      pools.ALGO,
      poolManagerAppId,
      userAccount.addr,
      escrow.addr,
      leverageAllocation,
      params,
      note
    );

    const addCollateralTxn = prepareAddCollateralToLoan(
      loanAppId,
      poolManagerAppId,
      userAccount.addr,
      escrow.addr,
      pools.ALGO,
      params
    );

    const syncCollateralTxn = prepareSyncCollateralInLoan(
      loanAppId,
      poolManagerAppId,
      userAccount.addr,
      escrow.addr,
      pools.ALGO,
      oracle,
      params
    );

    const borrowTxn = prepareBorrowFromLoan(
      loanAppId,
      poolManagerAppId,
      userAccount.addr,
      escrow.addr,
      userAccount.addr,
      pools.ALGO,
      oracle,
      [],
      [0],
      flashLoanRepaymentAmount,
      0,
      params
    );

    const leverageTxns = [...depositTxn, addCollateralTxn, ...syncCollateralTxn, ...borrowTxn];
    const txnsWithOpUp = prefixWithOpUp(opup, userAccount.addr, leverageTxns, budget, params);

    const wrapUpLoan = wrapWithFlashLoan(
      [...txnsWithOpUp],
      pools.ALGO,
      userAccount.addr,
      userAccount.addr,
      TestnetReserveAddress,
      flashLoanAmount,
      params
    );

    // Group and return all transactions
    const group1Txns = [
      { txn: fund_txn, signer: 'user' },
      { txn: optInTxn, signer: 'escrow' },
      { txn: openLoanTxns[0], signer: 'user' },
      { txn: openLoanTxns[1], signer: 'escrow' },
      { txn: optInUsdc, signer: 'user' },
      { txn: plpOptInTxn, signer: 'user' },
      { ...usdcDepositTxn, signer: 'user' },
      { ...zapTxGroup, signer: 'user' },  
    ];

    const group2Txns = wrapUpLoan;
    return {
      group1Txns,
      group2Txns,
      escrowAccount,
    };
  } catch (err) {
    console.error('Error during the loan process:', err);
    throw err;
  }
}
