import algosdk, {Transaction, decodeUnsignedTransaction} from 'algosdk';
import {
  prepareCreateUserLoan,
  prepareDepositIntoPool,
  prepareSyncCollateralInLoan,
  prepareBorrowFromLoan,
  TestnetPools,
  TestnetReserveAddress,
  prefixWithOpUp,
  prepareAddCollateralToLoan,
  retrieveUserLoanInfo,
  prepareRepayLoanWithCollateral,
  prepareReduceCollateralFromLoan,
  prepareRemoveCollateralFromLoan,
  prepareRemoveUserLoan,
  wrapWithFlashLoan,
} from 'folks-finance-js-sdk';
import { FolksRouterClient, Network, prepareEnableAssetToBeSwapped, SwapMode, SwapParams } from '@folks-router/js-sdk';

// Algod testnet endpoint using AlgoNode
const baseServer = 'https://testnet-api.algonode.cloud';
const port = ''; // AlgoNode does not require a port
const token = ''; // No token required for AlgoNode

// Instantiate the Algod client
const algodClient = new algosdk.Algodv2(token, baseServer, port);
const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud/', '');
const folksRouterClient = new FolksRouterClient(Network.TESTNET);

// Common variables
const loanAppId = 168153622;
const poolManagerAppId = 147157634;
const oracle = {
  oracle0AppId: 124087437,
  oracleAdapterAppId: 147153711,
  decimals: 14,
};
const opup = { callerAppId: 397104542, baseAppId: 118186203 };
const budget = Math.ceil(10);

export async function leveragedAPY(userAccount, depositAmount, loanName) {
  try {
    const params = await algodClient.getTransactionParams().do();
    const pools = TestnetPools;

    const flashLoanAmount = depositAmount * 2.5 * 1e6; // Convert to microAlgos
    const leverageAmount = depositAmount * 1e6 + flashLoanAmount;
    const feeRate = 0.0016; // 16 bp as a decimal
    const flashLoanRepaymentAmount = Math.floor(flashLoanAmount * (1 + feeRate));

    const note = new Uint8Array(Buffer.from(`ff/v1:j{"name":"${loanName}"}`));

    // Step 1: Open the loan
    const { txns: openLoanTxns, escrow } = prepareCreateUserLoan(loanAppId, userAccount.addr, params);
    console.log(escrow);
    const escrowAccount = {
      addr: escrow.addr,
      sk: escrow.sk
    };

    // Fund the escrow account
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
    
    const optInUsdc = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: userAccount.addr,
      to: userAccount.addr,
      amount: 0,
      assetIndex: 67395862,
      suggestedParams: params,
    });

    const optInAsset = prepareEnableAssetToBeSwapped(loanAppId,userAccount.addr, [67395862], params);
    console.log(optInAsset);
    // Collect all unsigned transactions for Group 1 (loan creation)
    const group1Txns = [
      { txn: fund_txn, signer: 'user' },
      { txn: optInTxn, signer: 'escrow' },
      { txn: openLoanTxns[0], signer: 'user' },
      { txn: openLoanTxns[1], signer: 'escrow' },
      // { txn: optInUsdc, signer: 'user' },    
    ];

     // construct swap params
     const swapParam: SwapParams = {
      fromAssetId: 67395862,
      toAssetId: 0,
      amount: BigInt(flashLoanRepaymentAmount),
      swapMode: SwapMode.FIXED_OUTPUT,
      };
  
      const swapQuote = await folksRouterClient.fetchSwapQuote(swapParam);
      console.log(swapQuote);

    // Step 2: Prepare second transaction group for leveraging APY
    const depositTxn = prepareDepositIntoPool(
      pools.ALGO,
      poolManagerAppId,
      userAccount.addr,
      escrow.addr,
      leverageAmount,
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
    console.log(swapQuote.quoteAmount);
    console.log(flashLoanRepaymentAmount);
   
    // Prepare Swap Transactions
   // const base64txns = await folksRouterClient.prepareSwapTransactions(swapParam, userAccount.addr, BigInt(10), swapQuote);
   // const unsignedTxns = base64txns.map((txn) => decodeUnsignedTransaction(Buffer.from(txn, "base64")));
    // Group all transactions
    const txns = [...depositTxn, addCollateralTxn, ...syncCollateralTxn, ...borrowTxn];
    const txnsWithOpUp = prefixWithOpUp(opup, userAccount.addr, txns, budget, params);

    const wrapUpLoan = wrapWithFlashLoan(
      [...txnsWithOpUp],
      pools.ALGO,
      userAccount.addr,
      userAccount.addr,
      TestnetReserveAddress,
      flashLoanAmount,
      params
    );

    const group2Txns = wrapUpLoan;
    console.log('WrapUpLoan Transactions:', wrapUpLoan);

    // Return both groups of unsigned transactions
    return {
      group1Txns,
      group2Txns,
      escrowAccount
    };
  } catch (err) {
    console.error('Error during the loan process:', err);
    throw err; // Rethrow the error for frontend handling
  }
}

export async function repayBorrow(userAccount, escrowAddr) {
  try {
    let params = await algodClient.getTransactionParams().do();
    const pools = TestnetPools;
    const transactions: Transaction[] = [];

    console.log('User Account Address:', userAccount.addr);
    console.log('Escrow Address:', escrowAddr);

    const loan = await retrieveUserLoanInfo(indexerClient, loanAppId, poolManagerAppId, oracle, escrowAddr);
    const repaymentAmount = loan.borrows[0].borrowBalance;
    console.log('Repayment amount', repaymentAmount);

    params = await algodClient.getTransactionParams().do();
    const repayTxn = prepareRepayLoanWithCollateral(
      loanAppId,
      poolManagerAppId,
      userAccount.addr,
      escrowAddr,
      escrowAddr,
      TestnetReserveAddress,
      pools.ALGO,
      repaymentAmount,
      false,
      params
    );
    if (Array.isArray(repayTxn)) {
      transactions.push(...repayTxn);
    } else {
      transactions.push(repayTxn);
    }
    return { transactions: transactions };
  } catch (err) {
    console.error("Error in the repay borrow process:", err);
    throw err;
  }
}

export async function withdrawFunds(userAccount, escrowAddr) {
  try {
    let params = await algodClient.getTransactionParams().do();
    const pools = TestnetPools;
    const transactions: Transaction[] = [];

    console.log('User Account Address:', userAccount.addr);
    console.log('Escrow Address:', escrowAddr);

    const loan = await retrieveUserLoanInfo(indexerClient, loanAppId, poolManagerAppId, oracle, escrowAddr);
    console.log('Loan Info:', loan); 
    
    const collateralAmount = loan.collaterals[0].assetBalance;
    console.log('Collateral amount', collateralAmount);

    params = await algodClient.getTransactionParams().do();
    const reduceCollateralTxn = prepareReduceCollateralFromLoan(
      loanAppId,
      poolManagerAppId,
      userAccount.addr,
      escrowAddr,
      userAccount.addr,
      pools.ALGO,
      oracle,
      [],
      [0],
      collateralAmount,
      false,
      params
    );
    const reduceCollateralTxns = prefixWithOpUp(opup, userAccount.addr, reduceCollateralTxn, budget, params)
    transactions.push(...reduceCollateralTxns);
    console.log('Reduce Collateral Transaction:', reduceCollateralTxns);

    params = await algodClient.getTransactionParams().do();
    const removeCollateralTxn = prepareRemoveCollateralFromLoan(
      loanAppId,
      userAccount.addr,
      escrowAddr,
      pools.ALGO,
      params
    );
    if (Array.isArray(removeCollateralTxn)) {
      transactions.push(...removeCollateralTxn);
    } else {
      transactions.push(removeCollateralTxn);
    }
    return { transactions: transactions };    
  } catch (err) {
    console.error("Error in the withdrawal process:", err);
    throw err;
  }
}

export async function removeLoan(userAccount, escrowAddr) {
  try {
    let params = await algodClient.getTransactionParams().do();
    const transactions: Transaction[] = [];

    params = await algodClient.getTransactionParams().do();
    const removeUserLoanTxn = prepareRemoveUserLoan(loanAppId, userAccount.addr, escrowAddr, params);
    if (Array.isArray(removeUserLoanTxn)) {
      transactions.push(...removeUserLoanTxn);
    } else {
      transactions.push(removeUserLoanTxn);
    }
    console.log('Remove User Loan Transaction:', removeUserLoanTxn);
    
    console.log('Transactions to return:', transactions);
    return { transactions: transactions };    
  } catch (err) {
    console.error("Error in the withdrawal process:", err);
    throw err;
  }
}

