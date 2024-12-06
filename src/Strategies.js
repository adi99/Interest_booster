import React from "react";
import "./Strategies.css";

const strategiesData = [
  {
    name: "ALGOBull3x",
    description: "High-risk, high-reward strategy with 3x leverage.",
    assets: ["ALGO", "goBTC", "goETH"],
    pools: ["Folks Pool 1", "Folks Pool 2"],
    icon: "https://via.placeholder.com/80", // Replace with actual icon URLs
  },
  {
    name: "ALGOBear1x",
    description: "Low-risk, conservative strategy for market downturns.",
    assets: ["ALGO", "USDC"],
    pools: ["Folks Pool 3"],
    icon: "https://via.placeholder.com/80", // Replace with actual icon URLs
  },
  {
    name: "Yield Optimizer",
    description: "Optimized for stable returns with balanced risk.",
    assets: ["goETH", "USDC"],
    pools: ["Folks Pool 1", "Folks Pool 2"],
    icon: "https://via.placeholder.com/80", // Replace with actual icon URLs
  },
];

function Strategies() {
  return (
    <div className="strategies-page">
      <header className="strategies-header">
        <h1>Strategies</h1>
        <p>Explore tailored strategies with optimized allocations and returns.</p>
      </header>
      <div className="strategies-grid">
        {strategiesData.map((strategy, index) => (
          <div key={index} className="strategy-card">
            <div className="strategy-icon">
              <img src={strategy.icon} alt={strategy.name} />
            </div>
            <div className="strategy-content">
              <h2>{strategy.name}</h2>
              <p>{strategy.description}</p>
              <div className="strategy-assets">
                <strong>Assets:</strong> {strategy.assets.join(", ")}
              </div>
              <div className="strategy-pools">
                <strong>Pools:</strong> {strategy.pools.join(", ")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Strategies;
