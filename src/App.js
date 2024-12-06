import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"; // Import Router
import { Link } from "react-router-dom";
import { NetworkId, WalletId, WalletManager, WalletProvider, useWallet } from '@txnlab/use-wallet-react';
import algosdk, { Indexer, AtomicTransactionComposer } from 'algosdk';
import { retrieveUserLoansInfo } from 'folks-finance-js-sdk';
import { SnackbarProvider } from 'notistack';
import { leveragedAPY, withdrawFunds, repayBorrow, removeLoan } from './contract.ts';
import LeveragedStrategy from "./LeveragedStrategy";
import StrategyBuilder from "./Strategybuilder.js";
import Strategies from "./Strategies";
import './global.css';
import './Lending.css'; 

// Common variables
const loanAppId = 168153622;
const poolManagerAppId = 147157634;
const oracle = {
  oracle0AppId: 124087437,
  oracleAdapterAppId: 147153711,
  decimals: 14,
};

const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud/', 443);
export const indexerClient = new Indexer('', 'https://testnet-idx.algonode.cloud/', 443);
const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.EXODUS,
    WalletId.PERA,
    {
      id: WalletId.WALLETCONNECT,
      options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' },
    },
  ],
  network: NetworkId.TESTNET,
});

function App() {
  const [walletBalance, setWalletBalance] = useState(0);

  return (
    <SnackbarProvider maxSnack={3}>
      <WalletProvider manager={walletManager}>
        <Router>
          {/* Persistent Navbar */}
          <Navbar setWalletBalance={setWalletBalance} />
          {/* Main Routes */}
          <Routes>
            {/* Leveraged Strategy Page */}
            <Route path="/leveraged-strategy" element={<LeveragedStrategy />} />
            <Route path="/strategy-builder" element={<StrategyBuilder />} />
            <Route path="/strategies" element={<Strategies />} />
            {/* Default/Landing Page (or other pages) */}
            <Route 
              path="/" 
              element={
                <>
                  <Lending walletBalance={walletBalance} setWalletBalance={setWalletBalance} />
                  <InnerApp setWalletBalance={setWalletBalance} />
                </>
              } 
            />
          </Routes>
        </Router>
      </WalletProvider>
    </SnackbarProvider>
  );
}

function InnerApp({ setWalletBalance }) {
  const { activeAccount } = useWallet();

  return (
    <div className="app-container">
      <Loans
        indexerClient={indexerClient}
        loanAppId={loanAppId}
        poolManagerAppId={poolManagerAppId}
        oracle={oracle}
        userAddress={activeAccount?.address}
      />
    </div>
  );
}

function Navbar({ setWalletBalance }) {
  const { wallets, activeWallet, activeAccount } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);

  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (activeAccount?.address) {
        const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
        try {
          const accountInfo = await algodClient.accountInformation(activeAccount.address).do();
          const balance = Number(accountInfo.amount) / 1e6;
          setWalletBalance(balance);
        } catch (error) {
          console.error('Failed to fetch account information:', error);
          setWalletBalance(0);
        }
      }
    };

    fetchWalletBalance();
  }, [activeAccount, setWalletBalance]);

  const handleConnect = async (walletId) => {
    const wallet = wallets.find((w) => w.id === walletId);
    if (!wallet) {
      console.error('Selected wallet not available');
      return;
    }

    try {
      await wallet.connect();
      setShowWalletOptions(false);
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  const handleDisconnect = async () => {
    if (activeWallet) {
      await activeWallet.disconnect();
      setWalletBalance(0);
    }
  };

  return (
    <div className="navbar">
      <div className="navbar-links">
        <Link to="/" className="app-title">Interest Booster</Link>
        <Link to="/leveraged-strategy" className="navbar-button">Leverage</Link>
        <Link to="/strategy-builder" className="navbar-button">Strategy Builder</Link>
        <Link to="/strategies" className="navbar-button">Strategies</Link>
      </div>
      <div className="connect-button-container">
        {!activeWallet ? (
          <>
            <button className="btn-connect" onClick={() => setShowWalletOptions(!showWalletOptions)}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
            {showWalletOptions && (
              <ul className="wallet-options">
                {wallets.map((wallet) => (
                  <li key={wallet.id}>
                    <button className="wallet-option-btn" onClick={() => handleConnect(wallet.id)}>
                      {wallet.metadata.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="connected-info">
            <p>
              {activeAccount?.address ? `${activeAccount.address.slice(0, 4)}...${activeAccount.address.slice(-4)}` : 'N/A'}
            </p>
            <button className="btn-disconnect" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


const assetInfo = {
  ALGO: { assetId: 0, decimals: 6, icon: '/icons/algo.png' },
  USDC: { assetId: 67395862, decimals: 6, icon: '/icons/usdc.png' },
  USDt: { assetId: 67396430, decimals: 6, icon: '/icons/usdt.png' },
  goBTC: { assetId: 67396528, decimals: 8, icon: '/icons/gobtc.png' },
  goETH: { assetId: 76598897, decimals: 8, icon: '/icons/goeth.webp' }
};

const Lending = ({ walletBalance, setWalletBalance }) => {
  const { activeAccount } = useWallet();
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [loanName, setLoanName] = useState('');
  const [userLoans, setUserLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assetBalances, setAssetBalances] = useState({
    ALGO: 0,
    gALGO: 0,
    USDC: 0,
    USDt: 0,
    goBTC: 0,
    goETH: 0
  });
  const { algodClient, transactionSigner } = useWallet();

  const fetchUserLoans = async () => {
    if (activeAccount?.address) {
      try {
        const loans = await retrieveUserLoansInfo(
          indexerClient,
          loanAppId,
          poolManagerAppId,
          oracle,
          activeAccount.address
        );
        setUserLoans(loans);
      } catch (error) {
        console.error('Error fetching user loans:', error);
      }
    }
  };

  const fetchWalletBalance = async () => {
    if (activeAccount?.address) {
      setIsLoading(true)
      try {
        const accountInfo = await algodClient.accountInformation(activeAccount.address).do()
        const newBalances = { ...assetBalances }

        // Set ALGO balance
        newBalances.ALGO = Number(accountInfo.amount) / Math.pow(10, assetInfo.ALGO.decimals)

        // Set balances for other assets
        accountInfo.assets.forEach(asset => {
          const assetName = Object.keys(assetInfo).find(name => assetInfo[name].assetId === asset['asset-id'])
          if (assetName) {
            newBalances[assetName] = Number(asset.amount) / Math.pow(10, assetInfo[assetName].decimals)
          }
        })

        setAssetBalances(newBalances)
      } catch (error) {
        console.error('Failed to fetch account information:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchWalletBalance()
  }, [activeAccount])

  const openDepositModal = (asset) => {
    setSelectedAsset(asset);
    setIsDepositModalOpen(true);
  };

  const closeDepositModal = () => {
    setIsDepositModalOpen(false);
    setDepositAmount('');
    setLoanName('');
  };
  
  const handleDeposit = async () => {
    if (typeof depositAmount === 'number' && depositAmount <= walletBalance) {
      if (!activeAccount) {
        console.error("Active account is not connected.");
        return;
      }
      const userAccount = { addr: activeAccount.address };
      try {
        const { group1Txns, group2Txns, escrowAccount } = await leveragedAPY(
          { addr: userAccount.addr },
          depositAmount,
          loanName
        );
  
        const atcGroup1 = new algosdk.AtomicTransactionComposer();
        
        for (const { txn, signer } of group1Txns) {
          // Determine which signer to use for each transaction
          let selectedSigner;
          if (signer === 'escrow') {
            selectedSigner = async () => [algosdk.signTransaction(txn, escrowAccount.sk).blob];
          } else {
            selectedSigner = transactionSigner; // Use the user's signer for 'user' designated transactions
          }
          
          atcGroup1.addTransaction({ txn, signer: selectedSigner });
        }    
  
        const group1Result = await atcGroup1.submit(algodClient);
        console.log("First group of transactions submitted.", group1Result);

        const atcGroup2 = new algosdk.AtomicTransactionComposer();
         for (let i = 0; i < group2Txns.length; i++) {
             const txn = group2Txns[i];
             if (i === 7) {
                 txn.fee = 2000; 
             }
             atcGroup2.addTransaction({ txn, signer: transactionSigner });
         }
         const group2Result = await atcGroup2.submit(algodClient);
         console.log("Second group of transactions submitted.", group2Result);
         
        // Refresh UI after transactions
        await fetchUserLoans();
        await fetchWalletBalance();
        closeDepositModal();
      } catch (error) {
        console.error("Error during deposit:", error);
      }
    }
  };
  
  const handleMaxClick = () => {
    setDepositAmount(walletBalance);
  };

  const apyRates = {
    ALGO: '9.36%',
    gALGO: '5.1%',
    USDC: '2.5%',
    USDt: '3.0%',
    goBTC: '7.2%',
    goETH: '6.8%'
  };

  const isDepositButtonEnabled = loanName.length > 0 && typeof depositAmount === 'number' && depositAmount > 0 && depositAmount <= walletBalance;

  return (
    <div className="lending-section">
      <h2>Lending</h2>
      <table className="lending-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Wallet Balance</th>
            <th>APY</th>
            <th>Total Deposited</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(assetInfo).map((asset) => (
            <tr key={asset}>
              <td className="asset-cell">
              <img src={`/icons/${asset.toLowerCase()}.png`} alt={`${asset} Icon`} className="asset-icon" />
                <span>{asset}</span>
              </td>
              <td>{assetBalances[asset].toFixed(6)}</td>
              <td>{apyRates[asset] || 'N/A'}</td>
              <td>{'Total Deposited'}</td>
              <td>
                <div className="button-group">
                  <button className="deposit-btn" onClick={() => openDepositModal(asset)}>Deposit</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isDepositModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Deposit {selectedAsset}</h3>
            <p>Enter loan name and amount to deposit (Max: <span className="max-amount" onClick={handleMaxClick}>{walletBalance} ALGO</span>)</p>
            <input
              type="text"
              value={loanName}
              onChange={(e) => setLoanName(e.target.value)}
              placeholder="Loan Name"
            />
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
              placeholder="0.00"
            />
            <div className="modal-actions">
              <button
                className="confirm-btn"
                onClick={handleDeposit}
                disabled={!isDepositButtonEnabled}
              >
                Confirm Deposit
              </button>
              <button className="cancel-btn" onClick={closeDepositModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Loans = ({ indexerClient, loanAppId, poolManagerAppId, oracle, userAddress }) => {
  const [userLoans, setUserLoans] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const { algodClient, activeAccount, transactionSigner } = useWallet();

  const fetchUserLoans = async () => {
    if (userAddress) {
      try {
        const loans = await retrieveUserLoansInfo(indexerClient, loanAppId, poolManagerAppId, oracle, userAddress);
        setUserLoans(loans);
      } catch (error) {
        console.error('Error fetching user loans:', error);
      }
    }
  };

  useEffect(() => {
    fetchUserLoans();
  }, [indexerClient, loanAppId, poolManagerAppId, oracle, userAddress]);

  const formatEscrowAddress = (address) => {
    return address ? `${address.slice(0, 2)}..${address.slice(-2)}` : 'N/A';
  };

  const handleWithdraw = async (escrowAddress, borrowBalance) => {
    if (!activeAccount) {
      throw new Error("Wallet not properly connected or missing signer.");
    }    

    if (borrowBalance !== 0) {
      setErrorMessage("Please repay the borrow balance before withdrawing.");
      return; // Prevent withdrawal if borrow balance is not zero
    }
  
    try {
      const userAccount = { addr: activeAccount.address };
      const { transactions } = await withdrawFunds(userAccount, escrowAddress);
      console.log('transactions', transactions);
  
      const atc = new AtomicTransactionComposer();
  
      // Add transactions to the composer
      transactions.forEach((txn) => {
        if (!txn.signer) {
          txn.signer = transactionSigner; // Assign the signer if missing
        }
        atc.addTransaction({ txn, signer: txn.signer });
      });
  
      // Check for missing signatures
      if (transactions.some((txn) => txn.signer == null)) {
        throw new Error(`Missing signatures in transactions`);
      }
  
      // Submit the transactions
      await atc.submit(algodClient);
      console.log("Withdraw transaction completed.");
  
      // Fetch updated loan data
      await fetchUserLoans();
      setErrorMessage(""); // Clear error message after successful withdrawal
    } catch (error) {
      console.error("Error withdrawing loan:", error);
      setErrorMessage("An error occurred during the withdrawal process.");
    }
  };  

  const handleRemoveLoan = async (escrowAddress) => {
    if (!activeAccount) {
      console.error("No active account found.");
      return;
    }

    try {
      const userAccount = { addr: activeAccount.address };
      const { transactions: txns } = await removeLoan(userAccount, escrowAddress);

      const atc = new algosdk.AtomicTransactionComposer();
      txns.forEach((txn) => atc.addTransaction({ txn, signer: transactionSigner }));

      await atc.submit(algodClient);
      console.log("Repay borrow transaction completed.");

      await fetchUserLoans();
    } catch (error) {
      console.error("Error repaying borrow:", error);
    }
  };

  const handleRepayBorrow = async (escrowAddress) => {
    if (!activeAccount) {
      console.error("No active account found.");
      return;
    }

    try {
      const userAccount = { addr: activeAccount.address };
      const { transactions: txns } = await repayBorrow(userAccount, escrowAddress);

      const atc = new algosdk.AtomicTransactionComposer();
      txns.forEach((txn) => atc.addTransaction({ txn, signer: transactionSigner }));

      await atc.submit(algodClient);
      console.log("Repay borrow transaction completed.");

      await fetchUserLoans();
    } catch (error) {
      console.error("Error repaying borrow:", error);
    }
  };

  return (
    <div className="loans-section">
      <h2>Your Loans</h2>
      <table className="loans-table">
        <thead>
          <tr>
            <th>Loan ID</th>
            <th>Asset</th>
            <th>Deposit Amount</th>
            <th>Deposit (USD)</th>
            <th>APY</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {userLoans.length === 0 ? (
            <tr>
              <td colSpan={6}>No loans found</td>
            </tr>
          ) : (
            userLoans.map((loan, index) => {
              const collateralBalance = Number(loan.collaterals?.[0]?.assetBalance ?? 0);
              const borrowBalance = Number(loan.borrows?.[0]?.borrowBalance ?? 0);
              const balanceValue = Number(loan.collaterals?.[0]?.balanceValue ?? 0);
              const borrowBalanceValue = Number(loan.borrows?.[0]?.borrowBalanceValue ?? 0);

              const depositAmount = (collateralBalance - borrowBalance) / 1e6;
              const depositUSD = (balanceValue - borrowBalanceValue) / 1e4;
              const assetId = loan.collaterals?.[0]?.assetId ?? 0;

              return (
                <tr key={index}>
                  <td>{formatEscrowAddress(loan.escrowAddress)}</td>
                  <td>{assetId === 0 ? 'ALGO' : assetId}</td>
                  <td>{depositAmount.toFixed(2)}</td>
                  <td>{depositUSD.toFixed(2)}</td>
                  <td>{loan.netRate ? (Number(loan.netRate) / 1e14).toFixed(2) + '%' : 'N/A'}</td>
                  <td>
                    <button className="repay-btn" onClick={() => handleRepayBorrow(loan.escrowAddress)}>Repay Borrow</button>
                    <button 
                      className="withdraw-btn" 
                      onClick={() => handleWithdraw(loan.escrowAddress, borrowBalance)}
                    >
                      Withdraw
                    </button>    
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};


export default App;