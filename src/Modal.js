import React from "react";
import "./Modal.css";

const Modal = ({
  onClose,
  onAdd,
  onRemove,
  availableItems,
  availablePools,
  availableStrategies,
  selectedAssets,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Select Items</h2>

        {/* Section for Assets */}
        <h3>Assets</h3>
        <ul>
          {availableItems.map((item) => (
            <li key={item.name}>
              <div className="asset-row">
                <span>{item.name} (APY: {item.apy}%)</span>
                {selectedAssets[item.name] ? (
                  <button
                    onClick={() => onRemove(item.name)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                ) : (
                  <button onClick={() => onAdd(item)} className="add-btn">
                    Add
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Section for Pools */}
        <h3>Pools</h3>
        <ul>
          {availablePools.map((pool, index) => (
            <li key={`pool-${index}`}>
              <div className="asset-row">
                <span>{pool}</span>
                {selectedAssets[pool] ? (
                  <button
                    onClick={() => onRemove(pool)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                ) : (
                  <button onClick={() => onAdd({ name: pool })} className="add-btn">
                    Add
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Section for Strategies */}
        <h3>Strategies</h3>
        <ul>
          {availableStrategies.map((strategy, index) => (
            <li key={`strategy-${index}`}>
              <div className="asset-row">
                <span>{strategy}</span>
                {selectedAssets[strategy] ? (
                  <button
                    onClick={() => onRemove(strategy)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                ) : (
                  <button onClick={() => onAdd({ name: strategy })} className="add-btn">
                    Add
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
