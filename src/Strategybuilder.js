import React, { useState } from "react";
import "./StrategyBuilder.css";
import Modal from "./Modal";
import { Chart } from "react-google-charts";

const assets = [
  { name: "ALGO", apy: 3.5 },
  { name: "goBTC", apy: 5.2 },
  { name: "goETH", apy: 4.1 },
];

const pools = ["Folks Pool 1", "Folks Pool 2", "Folks Pool 3"];
const strategies = ["ALGOBear1x", "ALGOBull2x", "ALGOBull3x", "ALGOBull4x"];

function StrategyBuilder() {
  const [strategyName, setStrategyName] = useState("");
  const [ticker, setTicker] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [allocations, setAllocations] = useState({});

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  // Handle adding an item to the strategy
  const handleAddItemToStrategy = (item) => {
    if (!allocations[item.name]) {
      const totalItems = Object.keys(allocations).length + 1;
      const equalWeight = 100 / totalItems;

      const newAllocations = { ...allocations, [item.name]: equalWeight };
      Object.keys(newAllocations).forEach((key) => {
        if (key !== item.name) {
          newAllocations[key] = equalWeight;
        }
      });

      setAllocations(newAllocations);
    }
  };

  // Handle removing an item from the strategy
  const handleRemoveItemFromStrategy = (itemName) => {
    const newAllocations = { ...allocations };
    delete newAllocations[itemName];

    const totalItems = Object.keys(newAllocations).length;
    const equalWeight = totalItems > 0 ? 100 / totalItems : 0;

    Object.keys(newAllocations).forEach((key) => {
      newAllocations[key] = equalWeight;
    });

    setAllocations(newAllocations);
  };

  // Handle percentage change
  const handlePercentageChange = (itemName, newPercentage) => {
    const totalPercent = Object.values(allocations).reduce(
      (acc, curr) => acc + curr,
      0
    );
    const parsedValue = parseFloat(newPercentage);

    // Only allow valid number entries and ensure the total doesn't exceed 100%
    if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 100) {
      if (totalPercent - allocations[itemName] + parsedValue <= 100) {
        const newAllocations = { ...allocations, [itemName]: parsedValue };
        setAllocations(newAllocations);
      } else {
        alert("Total allocation cannot exceed 100%");
      }
    } else {
      alert("Please enter a valid percentage between 0 and 100.");
    }
  };

  // Handle deployment of strategy
  const handleDeploy = () => {
    if (!strategyName || !ticker) {
      alert("Please provide a strategy name and ticker.");
      return;
    }
    if (Object.keys(allocations).length === 0) {
      alert("Please select at least one asset.");
      return;
    }

    const total = Object.values(allocations).reduce((sum, percent) => sum + percent, 0);
    if (total !== 100) {
      alert("Allocations must add up to 100%!");
      return;
    }

    alert(`Strategy "${strategyName}" with ticker "${ticker}" deployed!`);
  };

  // Prepare data for the chart
  const chartData = [["Item", "Percentage"]];
  Object.entries(allocations).forEach(([item, percentage]) => {
    chartData.push([item, percentage]);
  });

  return (
    <div className="strategy-builder">
      <header>
        <h1>Build Your Strategy</h1>
      </header>

      <div className="input-section">
        <div>
          <label htmlFor="strategy-name">Strategy Name:</label>
          <input
            id="strategy-name"
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder="Enter strategy name"
          />
        </div>
        <div>
          <label htmlFor="ticker">Ticker:</label>
          <input
            id="ticker"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Enter ticker"
          />
        </div>
      </div>

      <div className="basket-section">
        <h2>Primary Basket</h2>
        <button onClick={openModal}>Select Assets</button>
        <ul>
          {Object.keys(allocations).map((item) => (
            <li key={item}>
              <span>{item}: </span>
              <input
                type="number"
                value={allocations[item]}
                onChange={(e) => handlePercentageChange(item, e.target.value)}
                className="allocation-input"
              />
              <button
                onClick={() => handleRemoveItemFromStrategy(item)}
                className="remove-btn"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="preview-section">
        <h2>Allocation Overview</h2>
        {chartData.length > 1 ? (
          <Chart
            chartType="PieChart"
            data={chartData}
            width="100%"
            height="400px"
            options={{ title: "Allocation Overview", pieHole: 0.4 }}
          />
        ) : (
          <p>No allocations to preview.</p>
        )}
      </div>

      <div className="deploy-section">
        <button onClick={handleDeploy} className="deploy-btn">
          Deploy Strategy
        </button>
      </div>

      {modalOpen && (
        <Modal
          onClose={closeModal}
          onAdd={handleAddItemToStrategy}
          onRemove={handleRemoveItemFromStrategy}
          availableItems={assets}
          availablePools={pools}
          availableStrategies={strategies}
          selectedAssets={allocations}
        />
      )}
    </div>
  );
}

export default StrategyBuilder;
