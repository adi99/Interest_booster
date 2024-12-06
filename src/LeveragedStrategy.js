import React, { useState } from "react";
import Modal from "react-modal"; // Import react-modal
import {
  ALGOBear1x,
  ALGOBull2x,
  ALGOBull3x,
  ALGOBull4x,
  goBTCBear1x,
  goBTCBull2x,
  goBTCBull3x,
  goBTCBull4x,
  goETHBear1x,
  goETHBull2x,
  goETHBull3x,
  goETHBull4x,
} from "./leverage.ts"; // Import contract functions
import "./LeveragedStrategy.css";

// Modal styles
Modal.setAppElement("#root"); // Make sure to set the root element for accessibility
const modalStyles = {
  content: {
    width: "400px",
    margin: "auto",
    padding: "20px",
    borderRadius: "8px",
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
};

const strategies = [
  { asset: "ALGO", multipliers: [-1, 2, 3, 4] },
  { asset: "goBTC", multipliers: [-1, 2, 3, 4] },
  { asset: "goETH", multipliers: [-1, 2, 3, 4] },
];

// Strategy-specific deposit handlers from the contract
const depositHandlers = {
  ALGOBear1x,
  ALGOBull2x,
  ALGOBull3x,
  ALGOBull4x,
  goBTCBear1x,
  goBTCBull2x,
  goBTCBull3x,
  goBTCBull4x,
  goETHBear1x,
  goETHBull2x,
  goETHBull3x,
  goETHBull4x,
};

function LeveragedStrategy() {
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);

  const openModal = (strategyName) => {
    setSelectedStrategy(strategyName);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedStrategy(null);
  };

  const handleDeposit = () => {
    if (selectedStrategy && depositHandlers[selectedStrategy]) {
      depositHandlers[selectedStrategy](); // Call the corresponding contract function
      closeModal(); // Close the modal after deposit
    } else {
      console.error(`No handler defined for ${selectedStrategy}`);
    }
  };

  return (
    <div className="leveraged-strategy-page">
      <h1>Leveraged Strategies</h1>
      <ul className="strategy-list">
        {strategies.map((strategy) =>
          strategy.multipliers.map((multiplier) => {
            const name =
              multiplier === -1
                ? `${strategy.asset}Bear1x`
                : `${strategy.asset}Bull${multiplier}x`;
            return (
              <li key={name} className="strategy-item">
                <div className="strategy-details">
                  <img
                    src={`/icons/${strategy.asset.toLowerCase()}.png`}
                    alt={`${strategy.asset} Icon`}
                    className="asset-icon"
                  />
                  <span className="strategy-name">{name}</span>
                </div>
                <button
                  className="deposit-btn"
                  onClick={() => openModal(name)} // Open modal on click
                >
                  Deposit
                </button>
              </li>
            );
          })
        )}
      </ul>

      <Modal isOpen={isModalOpen} onRequestClose={closeModal} style={modalStyles}>
        <h2>Confirm Deposit</h2>
        <p>Are you sure you want to deposit into {selectedStrategy}?</p>
        <div className="modal-actions">
          <button className="confirm-btn" onClick={handleDeposit}>
            Confirm
          </button>
          <button className="cancel-btn" onClick={closeModal}>
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default LeveragedStrategy;
